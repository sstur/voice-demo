import type { AudioPlaybackContext } from '../context/AudioPlayback';
import { useAudioPlayback } from '../context/AudioPlayback';
import { sleep } from '../support/sleep';
import { audioClipPcm as audioClipPcmBase64 } from './audioClipPcm';

// This must be a multiple of 16 because it will be decoded from base64 (x / 4 * 3) then converted into float32 frames (x / 4).
const CHUNK_SIZE = 16 * 1024;

export async function playSample(
  audioPlaybackContext: AudioPlaybackContext,
  fullPcmBase64 = audioClipPcmBase64,
) {
  const audioStream = getAudioStream(fullPcmBase64);
  await new Promise<void>((resolve) => {
    void audioPlaybackContext.playSound(audioStream, {
      channels: 1,
      sampleRate: 16000,
      onDone: () => resolve(),
    });
  });
}

export function usePlaySample() {
  const audioPlaybackContext = useAudioPlayback();
  return async () => {
    await playSample(audioPlaybackContext);
  };
}

async function* getAudioStream(
  fullPcmBase64: string,
): AsyncIterableIterator<string> {
  const length = fullPcmBase64.length;
  for (let i = 0; i < length; i += CHUNK_SIZE) {
    if (i > 0) {
      await sleep(50);
    }
    const chunk = fullPcmBase64.slice(i, i + CHUNK_SIZE);
    yield chunk;
  }
}
