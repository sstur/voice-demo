import { Socket } from './socket';

// type ListeningState =
//   | { state: 'INITIALIZING'; abort?: boolean }
//   | { state: 'LISTENING'; listeningController: ListeningController }
//   | { state: 'STOPPING' };

// type AgentState =
//   | { state: 'WAITING' }
//   | { state: 'PLAYING'; playbackController: PlaybackController };

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
    const listeningController = new ListeningController(socket);
    this.state = {
      name: 'RUNNING',
      socket,
      turn: { name: 'USER_SPEAKING', listeningController },
    };
    await this.invoke(() => listeningController.start());
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

  constructor(socket: Socket) {
    this.socket = socket;
    this.state = { name: 'NONE' };
  }

  async start() {
    this.state = { name: 'INITIALIZING' };
    void this.socket.send({ type: 'START_UPLOAD_STREAM' });
    // { type: 'START_UPLOAD_STREAM_RESULT', success: true, uploadStreamId: string } | { type: 'START_UPLOAD_STREAM_RESULT', success: false, error: string }
    const message = await this.socket.waitForMessageOfType(
      'START_UPLOAD_STREAM_RESULT',
    );
    if (!message.success) {
      const errorMessage = String(message.error);
      this.state = { name: 'ERROR', error: errorMessage };
      throw new Error(errorMessage);
    }
    const uploadStreamId = String(message.uploadStreamId);
    const readableStream = await startRecording();
  }
}

class PlaybackController {
  socket: Socket;
  state: 'INITIALIZING' | 'PLAYING';

  constructor(socket: Socket) {
    this.socket = socket;
    this.state = 'INITIALIZING';
  }
}
