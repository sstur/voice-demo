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

// export async function playSound(init: { uri: string; onDone: () => void }) {
//   const { uri, onDone } = init;
//   console.log('>> Playing sound:', { uri });
//   await Audio.setAudioModeAsync({
//     playsInSilentModeIOS: true,
//   });
//   // Load the sound from a remote URL
//   const result = await safeInvoke(() =>
//     Audio.Sound.createAsync({ uri }, undefined, null, false),
//   );
//   if (!result.ok) {
//     console.log('>> E1:', result.error);
//     throw result.error;
//   }

//   console.log('>> Checkpoint 1.');

//   const { sound } = result.result;

//   // Set a callback to run when the sound finishes playing
//   sound.setOnPlaybackStatusUpdate((status) => {
//     console.log('>> setOnPlaybackStatusUpdate:', status);
//     if (!status.isLoaded || status.didJustFinish) {
//       onDone();
//       void sound.unloadAsync();
//     }
//   });

//   console.log('>> Checkpoint 2.');

//   // Play the sound
//   const foo = await safeInvoke(() => sound.playAsync());
//   if (!foo.ok) {
//     console.log('>> E2:', foo.error);
//     throw foo.error;
//   }

//   console.log({ result: foo.result });
// }

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
