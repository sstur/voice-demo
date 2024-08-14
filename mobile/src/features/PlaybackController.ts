import type {
  AudioPlaybackContext,
  PlaybackInstance,
} from '../context/AudioPlayback';
import { StateClass } from '../support/StateClass';

export class PlaybackController extends StateClass {
  audioStream: AsyncIterable<string>;
  audioPlaybackContext: AudioPlaybackContext;
  state:
    | { name: 'IDLE' }
    | { name: 'ERROR'; error: string }
    | { name: 'INITIALIZING'; shouldAbort: boolean }
    | { name: 'PLAYING'; sound: PlaybackInstance };
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
    this.state = { name: 'IDLE' };
    this.onError = onError;
    this.onDone = onDone;
  }

  async start() {
    this.state = { name: 'INITIALIZING', shouldAbort: false };
    const audioStream = this.audioStream;
    // TODO: Change state; enable cancel button in UI
    const sound = await this.audioPlaybackContext.playSound(audioStream, {
      channels: 1,
      sampleRate: 16000,
      onDone: () => {
        this.onDone();
      },
    });
    if (this.state.shouldAbort) {
      sound.stop();
      this.state = { name: 'IDLE' };
    } else {
      this.state = { name: 'PLAYING', sound };
    }
  }

  terminate() {
    const state = this.state;
    switch (state.name) {
      case 'INITIALIZING': {
        this.state = { name: 'INITIALIZING', shouldAbort: true };
        break;
      }
      case 'PLAYING': {
        state.sound.stop();
        this.state = { name: 'IDLE' };
        break;
      }
    }
  }
}
