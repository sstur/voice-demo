import type { AVPlaybackSource } from 'expo-av';
import { Audio } from 'expo-av';

export async function playSound(source: AVPlaybackSource) {
  const isLocal = typeof source === 'number' || !('uri' in source);
  const shouldDownloadFirst = !isLocal;
  const unloadAsync = once(() => sound.unloadAsync());
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });
  const sound = new Audio.Sound();
  const promise = new Promise<void>((resolve, reject) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        const { error } = status;
        if (error) {
          reject(new Error(error));
        }
        return;
      }
      if (status.didJustFinish) {
        unloadAsync();
        resolve();
      }
    });
  });
  await sound.loadAsync(source, { shouldPlay: true }, shouldDownloadFirst);
  return {
    wait: () => promise,
    stop: () => unloadAsync(),
  };
}

function once<A extends Array<unknown>>(
  fn: (...args: A) => void,
): (...args: A) => void {
  let called = false;

  return (...args: A) => {
    if (!called) {
      called = true;
      fn(...args);
    }
  };
}
