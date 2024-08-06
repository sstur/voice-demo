import { API_BASE_URL } from '../support/constants';
import { safeInvoke } from '../support/safeInvoke';
import { StateClass } from '../support/StateClass';
import { playSound } from './playSound';
import type { Socket } from './socket';

export class PlaybackController extends StateClass {
  socket: Socket;
  state:
    | { name: 'NONE' }
    | { name: 'INITIALIZING' }
    | { name: 'ERROR'; error: unknown }
    | { name: 'PLAYING' };
  onStarted: () => void;
  onError: (error: unknown) => void;
  onDone: () => void;

  constructor(init: {
    socket: Socket;
    onStarted: () => void;
    onError: (error: unknown) => void;
    onDone: () => void;
  }) {
    super();
    const { socket, onStarted, onError, onDone } = init;
    this.socket = socket;
    this.state = { name: 'NONE' };
    this.onStarted = onStarted;
    this.onError = onError;
    this.onDone = onDone;
  }

  async start(playbackUrl: string) {
    this.state = { name: 'INITIALIZING' };
    const result = await safeInvoke(() =>
      playSound({
        uri: API_BASE_URL + playbackUrl,
        onDone: () => {
          this.onDone();
        },
      }),
    );
    if (!result.ok) {
      const { error } = result;
      this.state = { name: 'ERROR', error };
      this.onError(error);
      return;
    }
    this.state = { name: 'PLAYING' };
    this.onStarted();
  }
}
