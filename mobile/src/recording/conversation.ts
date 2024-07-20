import { safeInvoke } from '../support/safeInvoke';
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

export class ConversationController {
  state: ConversationState = { name: 'STOPPED' };

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
    const message = await this.invoke(() => socket.waitForMessage());
    const { type } = message;
    if (type !== 'READY') {
      throw new Error('Invalid ready message from server');
    }
    await this.startUserTurn(socket);
  }

  onError(error: unknown) {
    this.state = { name: 'ERROR', error };
  }

  async startUserTurn(socket: Socket) {
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

  async startAgentTurn(socket: Socket) {
    const playbackController = new PlaybackController({
      socket,
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

class ListeningController {
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
        signal: abortController.signal,
      })
      .then(() => {
        // This will cause the sendStream below to finish up, calling onDone.
        void stopRecording();
      });
    const result = await safeInvoke(() => startRecording());
    if (!result.ok) {
      const errorMessage = String(result.error);
      this.state = { name: 'ERROR', error: errorMessage };
      this.onError(errorMessage);
      return;
    }
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

  private async sendStream(readableStream: AsyncGenerator<string, undefined>) {
    const { socket } = this;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
    while (true) {
      const { value, done } = await readableStream.next();
      if (done) {
        break;
      }
      await socket.send({ type: 'AUDIO_CHUNK', value });
    }
    await socket.send({ type: 'AUDIO_DONE' });
  }
}

class PlaybackController {
  socket: Socket;
  state:
    | { name: 'NONE' }
    | { name: 'INITIALIZING' }
    | { name: 'ERROR'; error: string }
    | { name: 'PLAYING' };
  onError: (error: unknown) => void;
  onDone: () => void;

  constructor(init: {
    socket: Socket;
    onError: (error: unknown) => void;
    onDone: () => void;
  }) {
    const { socket, onError, onDone } = init;
    this.socket = socket;
    this.state = { name: 'NONE' };
    this.onError = onError;
    this.onDone = onDone;
  }

  async start() {
    this.state = { name: 'INITIALIZING' };
    void this.socket.send({ type: 'START_PLAYBACK' });
    // { type: 'START_PLAYBACK_RESULT', success: true, playbackUrl: string } | { type: 'START_PLAYBACK_RESULT', success: false, error: string }
    const message = await this.socket.waitForMessageOfType(
      'START_PLAYBACK_RESULT',
    );
    if (!message.success) {
      const errorMessage = String(message.error);
      this.state = { name: 'ERROR', error: errorMessage };
      this.onError(errorMessage);
      return;
    }
    const playbackUrl = String(message.playbackUrl);
    console.log({ playbackUrl });
    // TODO: Setup playback
    // TODO: When done playing, invoke onDone() so ConversationController can go back to USER_SPEAKING
  }
}
