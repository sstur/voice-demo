import chime from '../../assets/chime-2.wav';
import type { AudioPlaybackContext } from '../context/AudioPlayback';
import { StateClass } from '../support/StateClass';
import { createSound } from './createSound';
import { ListeningController } from './ListeningController';
import { PlaybackController } from './PlaybackController';
import { Socket } from './socket';

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
  | { name: 'CLOSING' }
  | { name: 'CLOSED' }
  | { name: 'ERROR'; error: unknown };

export class ConversationController extends StateClass {
  state: ConversationState = { name: 'STOPPED' };
  audioPlaybackContext: AudioPlaybackContext;

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

  // TODO: Remove this?
  // stopListening() {
  //   const { state } = this;
  //   if (state.name !== 'RUNNING') {
  //     return;
  //   }
  //   const { turn } = state;
  //   if (turn.name !== 'USER_SPEAKING') {
  //     return;
  //   }
  //   const { listeningController } = turn;
  //   listeningController.stop();
  // }

  private onError(error: unknown) {
    this.state = { name: 'ERROR', error };
  }

  private async startUserTurn(socket: Socket) {
    const listeningController = new ListeningController({
      socket,
      onError: (error) => this.onError(error),
      onDone: () => {
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
    const audioStream = getAudioStream(socket);
    // TODO: At this point we're still in the USER_SPEAKING state; should we be in a transition state?
    await this.invoke(() => this.playChime());
    const playbackController = new PlaybackController({
      audioStream,
      audioPlaybackContext,
      onError: (error) => this.onError(error),
      onDone: () => {
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

function getAudioStream(socket: Socket): AsyncIterable<string> {
  const stream = socket.getIterableStream<string>('AUDIO_CHUNK', (message) => {
    const { value, done } = message;
    return done
      ? { value: undefined, done: true }
      : { value: String(value), done: false };
  });
  void socket.send({ type: 'START_PLAYBACK' });
  return stream;
}
