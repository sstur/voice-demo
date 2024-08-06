import { StateClass } from '../support/StateClass';
import { ListeningController } from './ListeningController';
import { PlaybackController } from './PlaybackController';
import { Socket } from './socket';

type ConversationState =
  | { name: 'STOPPED' }
  | { name: 'INITIALIZING' }
  | {
      name: 'RUNNING';
      socket: Socket;
      listeningController: ListeningController;
      playbackController: PlaybackController;
    }
  | { name: 'CLOSING' }
  | { name: 'CLOSED' }
  | { name: 'ERROR'; error: unknown };

export class ConversationController extends StateClass {
  state: ConversationState = { name: 'STOPPED' };

  constructor() {
    super();
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
        const { listeningController, playbackController } = state;
        listeningController.emitter.on('change', emitChange);
        playbackController.emitter.on('change', emitChange);
        removeListener = () => {
          listeningController.emitter.off('change', emitChange);
          playbackController.emitter.off('change', emitChange);
        };
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
    void socket.send({ type: 'INIT' });
    const message = await this.invoke(() =>
      socket.waitForMessageOfType('READY'),
    );
    const playbackUrl = String(message.playbackUrl);
    const startTime = Date.now();
    const listeningController = new ListeningController({
      socket,
      onStarted: () => {
        const timeElapsed = Date.now() - startTime;
        console.log(`Listening started in ${timeElapsed}ms`);
      },
      onError: (error) => this.onError(error),
      onDone: () => {
        // TODO
      },
    });
    const playbackController = new PlaybackController({
      socket,
      onStarted: () => {
        const timeElapsed = Date.now() - startTime;
        console.log(`Playback started in ${timeElapsed}ms`);
      },
      onError: (error) => this.onError(error),
      onDone: () => {
        // TODO
      },
    });

    await this.invoke(() => {
      return Promise.all([
        listeningController.start(),
        playbackController.start(playbackUrl),
      ]);
    });

    this.state = {
      name: 'RUNNING',
      socket,
      listeningController,
      playbackController,
    };
  }

  onError(error: unknown) {
    this.state = { name: 'ERROR', error };
  }
}
