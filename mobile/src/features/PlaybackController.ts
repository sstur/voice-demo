import type { AudioPlaybackContext } from '../context/AudioPlayback';
import { StateClass } from '../support/StateClass';

export class PlaybackController extends StateClass {
  audioStream: AsyncIterable<string>;
  audioPlaybackContext: AudioPlaybackContext;
  state:
    | { name: 'NONE' }
    | { name: 'INITIALIZING' }
    | { name: 'ERROR'; error: string }
    | { name: 'PLAYING' };
  onError: (error: unknown) => void;
  onDone: () => void;

  constructor(init: {
    audioStream: AsyncIterable<string>;
    audioPlaybackContext: AudioPlaybackContext;
    onError: (error: unknown) => void;
    onDone: () => void;
  }) {
    super();
    const { audioStream, audioPlaybackContext, onError, onDone } = init;
    this.audioStream = audioStream;
    this.audioPlaybackContext = audioPlaybackContext;
    this.state = { name: 'NONE' };
    this.onError = onError;
    this.onDone = onDone;
  }

  async start() {
    this.state = { name: 'INITIALIZING' };
    const audioStream = this.audioStream;
    // TODO: Change state; enable cancel button in UI
    const _sound = await this.audioPlaybackContext.playSound(audioStream, {
      channels: 1,
      sampleRate: 16000,
      onDone: () => {
        this.onDone();
      },
    });
  }
}
