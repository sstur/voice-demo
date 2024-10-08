import type { MutableRefObject } from 'react';

import type {
  AudioPlaybackContext,
  PlaybackInstance,
} from '../context/AudioPlayback';
import { StateClass } from '../support/StateClass';
import type { Caption } from './types';

export class PlaybackController extends StateClass {
  audioStream: AsyncIterable<string>;
  captionsRef: MutableRefObject<Array<Caption>>;
  abortController: AbortController;
  audioPlaybackContext: AudioPlaybackContext;
  playbackStartTimeRef: MutableRefObject<number | null> = {
    current: null,
  };
  state:
    | { name: 'IDLE' }
    | { name: 'ERROR'; error: string }
    | { name: 'INITIALIZING'; shouldAbort: boolean }
    | { name: 'PLAYING'; sound: PlaybackInstance };
  private onDone: () => void;

  constructor(init: {
    audioStream: AsyncIterable<string>;
    captionsRef: MutableRefObject<Array<Caption>>;
    abortController: AbortController;
    audioPlaybackContext: AudioPlaybackContext;
    onDone: () => void;
  }) {
    super();
    const {
      audioStream,
      captionsRef,
      abortController,
      audioPlaybackContext,
      onDone,
    } = init;
    this.audioStream = audioStream;
    this.captionsRef = captionsRef;
    this.abortController = abortController;
    this.audioPlaybackContext = audioPlaybackContext;
    this.state = { name: 'IDLE' };
    this.onDone = onDone;
  }

  async start() {
    this.state = { name: 'INITIALIZING', shouldAbort: false };
    const audioStream = this.audioStream;
    const sound = await this.audioPlaybackContext.playSound(audioStream, {
      channels: 1,
      sampleRate: 16000,
      abortController: this.abortController,
      onStart: () => {
        this.playbackStartTimeRef.current = Date.now();
      },
      onDone: () => {
        this.abortController.abort();
        // When sound.stop() is called below, that will land us here this but we don't want to call onDone in that case.
        if (this.state.name === 'PLAYING') {
          this.onDone();
        }
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
    this.abortController.abort();
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
