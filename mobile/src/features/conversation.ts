import type { MutableRefObject } from 'react';
import * as Haptics from 'expo-haptics';

import chime from '../../assets/chime-2.wav';
import type { AudioPlaybackContext } from '../context/AudioPlayback';
import { createSound } from '../support/createSound';
import { parseMessage } from '../support/parseMessage';
import { Socket } from '../support/socket';
import { StateClass } from '../support/StateClass';
import { ListeningController } from './ListeningController';
import { PlaybackController } from './PlaybackController';
import type { Caption, ConversationMessage } from './types';

const { NotificationFeedbackType } = Haptics;

const chimePromise = createSound(chime);

type ConversationState =
  | { name: 'STOPPED' }
  | { name: 'INITIALIZING' }
  | {
      name: 'RUNNING';
      socket: Socket;
      turn:
        | { name: 'USER_SPEAKING'; listeningController: ListeningController }
        | { name: 'AGENT_SPEAKING'; playbackController: PlaybackController };
    }
  | { name: 'ERROR'; error: unknown };

export class ConversationController extends StateClass {
  state: ConversationState = { name: 'STOPPED' };
  conversation: Array<ConversationMessage> = [];
  private audioPlaybackContext: AudioPlaybackContext;

  constructor(init: { audioPlaybackContext: AudioPlaybackContext }) {
    super();
    this.audioPlaybackContext = init.audioPlaybackContext;
    let removeListener: (() => void) | null = null;
    let isEmitting = false;
    const emitChange = () => {
      isEmitting = true;
      this.emitter.emit('change');
      isEmitting = false;
    };
    this.emitter.on('change', () => {
      if (isEmitting) {
        return;
      }
      const state = this.state;
      if (removeListener) {
        removeListener();
        removeListener = null;
      }
      if (state.name === 'RUNNING') {
        const { turn } = state;
        switch (turn.name) {
          case 'USER_SPEAKING': {
            turn.listeningController.emitter.on('change', emitChange);
            removeListener = () => {
              turn.listeningController.emitter.off('change', emitChange);
            };
            break;
          }
          case 'AGENT_SPEAKING': {
            turn.playbackController.emitter.on('change', emitChange);
            removeListener = () => {
              turn.playbackController.emitter.off('change', emitChange);
            };
            break;
          }
        }
      }
    });
  }

  private async invoke<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.state = { name: 'ERROR', error };
      throw error;
    }
  }

  async start() {
    if (this.state.name !== 'STOPPED') {
      throw new Error(`Cannot start in state ${this.state.name}`);
    }
    this.state = { name: 'INITIALIZING' };
    const socket = new Socket();
    await this.invoke(() => socket.open('/sockets/chat'));
    // TODO: Listen for socket close
    await this.invoke(() => socket.waitForMessage('READY'));
    await this.startUserTurn(socket);
  }

  changeTurn() {
    const { state } = this;
    if (state.name !== 'RUNNING') {
      return;
    }
    const { turn } = state;
    if (turn.name === 'USER_SPEAKING') {
      const { listeningController } = turn;
      listeningController.stop();
    } else {
      const { playbackController } = turn;
      playbackController.terminate();
      this.onPlaybackInterrupted(playbackController, state.socket);
      void this.startUserTurn(state.socket);
    }
  }

  private onPlaybackComplete(playbackController: PlaybackController) {
    const { captionsRef } = playbackController;
    const contentPlayed = captionsRef.current.map(({ text }) => text).join(' ');
    this.conversation.push({
      role: 'ASSISTANT',
      content: contentPlayed,
    });
  }

  private onPlaybackInterrupted(
    playbackController: PlaybackController,
    socket: Socket,
  ) {
    const { captionsRef, playbackStartTimeRef } = playbackController;
    const playbackStartTime = playbackStartTimeRef.current;
    const numMsPlayed =
      playbackStartTime === null ? 0 : Math.abs(Date.now() - playbackStartTime);
    const contentPlayed = getContentPlayed(captionsRef.current, numMsPlayed);
    // TODO: Send a message to the server to update its conversation with this partial content
    this.conversation.push({
      role: 'ASSISTANT',
      content: contentPlayed,
    });
    if (contentPlayed) {
      void socket.send({ type: 'PARTIAL_PLAYBACK', contentPlayed });
    }
  }

  terminate() {
    const { state } = this;
    // TODO: If state.name === INITIALIZING need to abort
    if (state.name !== 'RUNNING') {
      return;
    }
    const { turn, socket } = state;
    if (turn.name === 'USER_SPEAKING') {
      const { listeningController } = turn;
      listeningController.terminate();
    } else {
      const { playbackController } = turn;
      playbackController.terminate();
      this.onPlaybackInterrupted(playbackController, state.socket);
    }
    void socket.close();
    this.state = { name: 'STOPPED' };
  }

  private onError(error: unknown) {
    this.state = { name: 'ERROR', error };
  }

  private async startUserTurn(socket: Socket) {
    if (
      this.state.name === 'RUNNING' &&
      this.state.turn.name === 'USER_SPEAKING'
    ) {
      // Can't start user turn if already started.
      return;
    }
    // Ideally we should invoke this after the microphone has starts, but that
    // doesn't seem to work. It seems to fail silently.
    void Haptics.notificationAsync(NotificationFeedbackType.Success);
    const listeningController = new ListeningController({
      socket,
      onError: (error) => this.onError(error),
      onDone: (transcription) => {
        this.conversation.push({
          role: 'USER',
          content: transcription,
        });
        void this.startAgentTurn(socket);
      },
    });
    this.state = {
      name: 'RUNNING',
      socket,
      turn: { name: 'USER_SPEAKING', listeningController },
    };
    await this.invoke(() => listeningController.start());
  }

  private async playChime() {
    const sound = await chimePromise;
    await sound.play({ wait: true });
  }

  private async startAgentTurn(socket: Socket) {
    const { audioPlaybackContext } = this;
    const abortController = new AbortController();
    abortController.signal.addEventListener('abort', () => {
      if (socket.state.name === 'OPEN') {
        void socket.send({ type: 'ABORT_PLAYBACK' });
      }
    });
    const audioStream = getAudioStream(socket, abortController);
    const captionsRef = getCaptionsRef(socket, abortController);
    // TODO: At this point we're still in the USER_SPEAKING state; should we be in a transition state?
    await this.invoke(() => this.playChime());
    const playbackController = new PlaybackController({
      audioStream,
      captionsRef,
      abortController,
      audioPlaybackContext,
      onDone: () => {
        this.onPlaybackComplete(playbackController);
        void this.startUserTurn(socket);
      },
    });
    this.state = {
      name: 'RUNNING',
      socket,
      turn: { name: 'AGENT_SPEAKING', playbackController },
    };
    await this.invoke(() => playbackController.start());
  }
}

function getAudioStream(
  socket: Socket,
  abortController: AbortController,
): AsyncIterable<string> {
  const stream = socket.getIterableStream<string>(
    'AUDIO_CHUNK',
    (message) => {
      const { value, done } = message;
      return done
        ? { value: undefined, done: true }
        : { value: String(value), done: false };
    },
    abortController,
  );
  void socket.send({ type: 'START_PLAYBACK' });
  return stream;
}

function getCaptionsRef(socket: Socket, abortController: AbortController) {
  const captionsRef: MutableRefObject<Array<Caption>> = { current: [] };
  const ws = socket.getWebSocket('captions');
  ws.addEventListener(
    'message',
    (event) => {
      const message = parseMessage(String(event.data));
      if (message.type === 'AUDIO_CAPTION') {
        const captions = toArray(message.captions);
        for (const maybeCaption of captions) {
          const caption = Object(maybeCaption);
          const text = String(caption.text);
          const startTime = Number(caption.startTime);
          const endTime = Number(caption.endTime);
          captionsRef.current.push({ text, startTime, endTime });
        }
      }
    },
    { signal: abortController.signal },
  );
  return captionsRef;
}

function toArray(input: unknown): Array<unknown> {
  return Array.isArray(input) ? input : [];
}

function getContentPlayed(captions: Array<Caption>, numMsPlayed: number) {
  const fragments: Array<string> = [];
  for (const caption of captions) {
    if (caption.startTime < numMsPlayed) {
      fragments.push(caption.text);
    } else {
      break;
    }
  }
  return fragments.join(' ');
}
