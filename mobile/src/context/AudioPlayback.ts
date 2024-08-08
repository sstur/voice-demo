import { createContext } from '../support/createContext';

export type PlaybackInstance = {
  stop: () => void;
};

export type PlaybackOptions = {
  channels: number;
  sampleRate: number;
  onDone?: () => void;
};

export type AudioPlaybackContext = {
  playSound: (
    audioStream: AsyncIterable<string>,
    options: PlaybackOptions,
  ) => Promise<PlaybackInstance>;
};

const [useAudioPlayback, AudioPlaybackContextProvider] =
  createContext<AudioPlaybackContext>('AudioPlayback');

export { useAudioPlayback, AudioPlaybackContextProvider };
