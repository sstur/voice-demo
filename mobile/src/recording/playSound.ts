import { Audio } from 'expo-av';

export async function playSound(init: { uri: string; onDone: () => void }) {
  const { uri, onDone } = init;
  const shouldDownloadFirst = false;
  const unloadAsync = once(() => sound.unloadAsync());
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
  });
  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true },
    (status) => {
      if (!status.isLoaded) {
        const { error } = status;
        if (error) {
          // eslint-disable-next-line no-console
          console.warn(error);
        }
        return;
      }
      if (status.didJustFinish) {
        unloadAsync();
        onDone();
      }
    },
    shouldDownloadFirst,
  );
  return {
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
