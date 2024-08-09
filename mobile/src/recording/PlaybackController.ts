import type { AudioPlaybackContext } from '../context/AudioPlayback';
import { StateClass } from '../support/StateClass';
import type { Socket } from './socket';

export class PlaybackController extends StateClass {
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
    const message = await socket.waitForMessage('AUDIO_CHUNK');
    const chunk = message.value;
    if (typeof chunk === 'string' && chunk.length) {
      yield chunk;
    }
    if (message.done) {
      break;
    }
  }
}
