/**
 * This creates a readable stream from a file assuming new data MAY be be
 * written to the end of the file while we're reading it.
 *
 * Because of this we cannot assume that when we get to the end of the file
 * we're done, we MUST wait for a signal to know that the writing process is
 * complete.
 *
 * Each chunk of data that is emitted will be base64 encoded.
 */

import * as FileSystem from 'expo-file-system';

import type { File } from '../support/File';
import { sleep } from '../support/sleep';

const MAX_CHUNK_SIZE = 4 * 1024;

export async function* createAsyncReadable(
  file: File,
  onDone: () => void,
): AsyncGenerator<string, undefined> {
  const { fileUri } = file;
  let bytesProcessed = 0;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const info = await FileSystem.getInfoAsync(fileUri, { size: true });
    const bytesAvailable = info.exists ? info.size : 0;
    const bytesToProcess = Math.max(0, bytesAvailable - bytesProcessed);
    if (bytesToProcess === 0) {
      if (file.isOpen()) {
        await sleep(100);
        continue;
      } else {
        onDone();
        break;
      }
    }
    const startPosition = bytesProcessed;
    const chunkSize = Math.min(bytesToProcess, MAX_CHUNK_SIZE);
    bytesProcessed += chunkSize;
    const chunk = await FileSystem.readAsStringAsync(fileUri, {
      position: startPosition,
      length: chunkSize,
      encoding: 'base64',
    });
    yield chunk;
  }
}
