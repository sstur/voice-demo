import chime from '../../assets/chime-2.wav';
import type { AudioPlaybackContext } from '../context/AudioPlayback';
import { safeInvoke } from '../support/safeInvoke';
import { StateClass } from '../support/StateClass';
import { playSound } from './playSound';
import { startRecording, stopRecording } from './Recording';
import { Socket } from './socket';

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
    await this.invoke(() => socket.waitForMessageOfType('READY'));
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

  onError(error: unknown) {
    this.state = { name: 'ERROR', error };
  }

  async startUserTurn(socket: Socket) {
    const listeningController = new ListeningController({
      socket,
      onError: (error) => this.onError(error),
      onDone: async () => {
        const sound = await playSound(chime);
        await sound.wait();
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

  async startAgentTurn(socket: Socket) {
    const { audioPlaybackContext } = this;
    const playbackController = new PlaybackController({
      socket,
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

class ListeningController extends StateClass {
  socket: Socket;
  state:
    | { name: 'NONE' }
    | { name: 'INITIALIZING' }
    | { name: 'ERROR'; error: string }
    | { name: 'LISTENING' }
    | { name: 'STOPPING' };
  onError: (error: unknown) => void;
  onDone: () => void;

  constructor(init: {
    socket: Socket;
    onError: (error: unknown) => void;
    onDone: () => void;
  }) {
    super();
    const { socket, onError, onDone } = init;
    this.socket = socket;
    this.state = { name: 'NONE' };
    this.onError = onError;
    this.onDone = onDone;
  }

  async start() {
    this.state = { name: 'INITIALIZING' };
    void this.socket.send({ type: 'START_UPLOAD_STREAM' });
    // { type: 'START_UPLOAD_STREAM_RESULT', success: true } | { type: 'START_UPLOAD_STREAM_RESULT', success: false, error: string }
    const message = await this.socket.waitForMessageOfType(
      'START_UPLOAD_STREAM_RESULT',
    );
    if (!message.success) {
      const errorMessage = String(message.error);
      this.state = { name: 'ERROR', error: errorMessage };
      this.onError(errorMessage);
      return;
    }
    // TODO: abort when we transition out of state LISTENING?
    const abortController = new AbortController();
    void this.socket
      .waitForMessageOfType('STOP_UPLOAD_STREAM', {
        timeout: 0,
        signal: abortController.signal,
      })
      .then(() => {
        this.stop();
      });
    const result = await safeInvoke(() => startRecording());
    if (!result.ok) {
      const errorMessage = String(result.error);
      this.state = { name: 'ERROR', error: errorMessage };
      this.onError(errorMessage);
      return;
    }
    void this.socket.send({ type: 'RECORDING_STARTED' });
    console.log('>> Started listening...');
    this.state = { name: 'LISTENING' };
    const readableStream = result.result;
    this.sendStream(readableStream)
      .then(() => {
        // This means we called stopRecording(), e.g. from a STOP_UPLOAD_STREAM message from the server
        this.onDone();
      })
      .catch((error: unknown) => {
        // This means either the recording errored or a websocket issue
        this.state = { name: 'ERROR', error: String(error) };
        this.onError(error);
      })
      .finally(() => {
        // Stop listening for the STOP_UPLOAD_STREAM message from server
        abortController.abort();
      });
  }

  stop() {
    // This will cause the sendStream to finish up, calling onDone.
    void stopRecording();
  }

  private async sendStream(readableStream: AsyncGenerator<string, undefined>) {
    const { socket } = this;
    // TODO: Use for..await
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
    while (true) {
      const { value, done } = await readableStream.next();
      if (value) {
        await socket.send({ type: 'AUDIO_CHUNK', value });
      }
      if (done) {
        break;
      }
    }
    await socket.send({ type: 'AUDIO_DONE' });
  }
}

class PlaybackController extends StateClass {
  socket: Socket;
  audioPlaybackContext: AudioPlaybackContext;
  state:
    | { name: 'NONE' }
    | { name: 'INITIALIZING' }
    | { name: 'ERROR'; error: string }
    | { name: 'PLAYING' };
  onError: (error: unknown) => void;
  onDone: () => void;

  constructor(init: {
    socket: Socket;
    audioPlaybackContext: AudioPlaybackContext;
    onError: (error: unknown) => void;
    onDone: () => void;
  }) {
    super();
    const { socket, audioPlaybackContext, onError, onDone } = init;
    this.socket = socket;
    this.audioPlaybackContext = audioPlaybackContext;
    this.state = { name: 'NONE' };
    this.onError = onError;
    this.onDone = onDone;
  }

  async start() {
    this.state = { name: 'INITIALIZING' };
    const audioStream = getAudioStream(this.socket);
    // TODO: Change state; enable cancel button in UI
    const startTime = Date.now();
    console.log('Starting playback...');
    const _sound = await this.audioPlaybackContext.playSound(audioStream, {
      channels: 1,
      sampleRate: 16000,
      onDone: () => {
        const timeElapsed = Date.now() - startTime;
        console.log(`Playback complete in ${timeElapsed}ms`);
        this.onDone();
      },
    });
  }
}

// TODO: I don't think we can do it this way because we're not buffering the messages
async function* getAudioStream(socket: Socket): AsyncIterableIterator<string> {
  void socket.send({ type: 'START_PLAYBACK' });
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const message = await socket.waitForMessageOfType('AUDIO_CHUNK');
    const chunk = message.value;
    if (typeof chunk === 'string' && chunk.length) {
      yield chunk;
    }
    if (message.done) {
      break;
    }
  }
}
