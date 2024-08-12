import type { AudioPlaybackContext } from '../context/AudioPlayback';
import { sleep } from '../support/sleep';

// This must be a multiple of 16 because it will be decoded from base64 (x / 4 * 3) then converted into float32 frames (x / 4).
const CHUNK_SIZE = 16 * 1024;

export async function playFromArray(
  audioPlaybackContext: AudioPlaybackContext,
  chunks: Array<ArrayBuffer>,
) {
  const buffer = combine(chunks);
  const audioStream = getAudioStream(toBase64(buffer));
  await new Promise<void>((resolve) => {
    void audioPlaybackContext.playSound(audioStream, {
      channels: 1,
      sampleRate: 16000,
      onDone: () => resolve(),
    });
  });
}

function toBase64(arrayBuffer: ArrayBuffer) {
  const uint8View = new Uint8Array(arrayBuffer);
  let binaryString = '';
  for (const byte of uint8View) {
    binaryString += String.fromCharCode(byte);
  }
  return btoa(binaryString);
}

function combine(buffers: Array<ArrayBuffer>) {
  const totalLength = buffers.reduce(
    (acc, buffer) => acc + buffer.byteLength,
    0,
  );
  const combinedBuffer = new ArrayBuffer(totalLength);
  const combinedView = new Uint8Array(combinedBuffer);
  let offset = 0;
  for (const buffer of buffers) {
    const view = new Uint8Array(buffer);
    combinedView.set(view, offset);
    offset += buffer.byteLength;
  }
  return combinedBuffer;
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
