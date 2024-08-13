import type { AVPlaybackSource, AVPlaybackStatus } from 'expo-av';
import { Audio } from 'expo-av';

import { EventEmitter } from './EventEmitter';
import { once } from './once';
import { sleep } from './sleep';

type EventMap = {
  playbackStatusUpdate: [status: AVPlaybackStatus];
};

type State = { name: 'IDLE'; hasBeenPlayed: boolean } | { name: 'PLAYING' };

export async function createSound(source: AVPlaybackSource) {
  const unloadAsync = once(() => sound.unloadAsync());
  const sound = new Audio.Sound();
  const emitter = new EventEmitter<EventMap>();
  sound.setOnPlaybackStatusUpdate((status) => {
    emitter.emit('playbackStatusUpdate', status);
  });
  const status = await sound.loadAsync(source, { shouldPlay: false });
  const duration = (status.isLoaded && status.durationMillis) || 0;
  let state: State = { name: 'IDLE', hasBeenPlayed: false };
  return {
    play: async (options: { wait?: true } = {}) => {
      if (state.name !== 'IDLE') {
        return;
      }
      const { hasBeenPlayed } = state;
      state = { name: 'PLAYING' };
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      if (hasBeenPlayed) {
        await sound.replayAsync();
      } else {
        await sound.playAsync();
      }
      const onStatusChange = (status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          emitter.off('playbackStatusUpdate', onStatusChange);
          state = { name: 'IDLE', hasBeenPlayed: true };
        }
      };
      emitter.on('playbackStatusUpdate', onStatusChange);
      if (options.wait) {
        await sleep(duration);
      }
    },
    unload: () => unloadAsync(),
  };
}
