import { EventEmitter } from './EventEmitter';

// This must be a multiple of 4 because it will be converted into float32 frames.
const CHUNK_SIZE = 12 * 1024;

const MIN_BUFFERED_TO_START = 10 * CHUNK_SIZE;

type EventMap = {
  write: [];
};

export class AudioQueue implements AsyncIterableIterator<string> {
  private chunks: Array<ArrayBuffer> = [];
  private totalBytesBuffered = 0;
  private isClosed = false;
  private emitter = new EventEmitter<EventMap>();
  private isStarted = false;

  async next(): Promise<IteratorResult<string, undefined>> {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
    while (true) {
      if (
        this.isStarted ||
        this.isClosed ||
        this.totalBytesBuffered >= MIN_BUFFERED_TO_START
      ) {
        if (!this.isStarted) {
          console.log(
            'Starting stream with buffered:',
            this.totalBytesBuffered,
          );
          this.isStarted = true;
        }
        if (this.totalBytesBuffered >= CHUNK_SIZE) {
          const chunksToEmit: Array<ArrayBuffer> = [];
          let byteCount = 0;
          while (byteCount < CHUNK_SIZE) {
            const chunk = this.chunks.shift();
            if (!chunk) {
              break;
            }
            chunksToEmit.push(chunk);
            byteCount += chunk.byteLength;
          }
          if (byteCount > 0) {
            const combinedChunk = combine(chunksToEmit, byteCount);
            console.log(
              `>> Emitting chunk of size ${byteCount} bytes (${byteCount % 4 === 0})`,
            );
            this.totalBytesBuffered -= byteCount;
            console.log(`>> Remaining buffered: ${this.totalBytesBuffered}`);
            return { done: false, value: toBase64(combinedChunk) };
          }
        }
        if (this.isClosed) {
          break;
        }
      }
      await new Promise<void>((resolve) => this.emitter.once('write', resolve));
    }
    return { done: true, value: undefined };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async write(value: string) {
    if (!this.isClosed) {
      const buffer = fromBase64(value);
      // console.log(`>> Incoming chunk of size ${buffer.byteLength} bytes`);
      this.chunks.push(buffer);
      this.totalBytesBuffered += buffer.byteLength;
      this.emitter.emit('write');
    }
  }

  close() {
    this.isClosed = true;
    // Emitting "write" here in case next above is waiting for it
    this.emitter.emit('write');
  }

  [Symbol.asyncIterator]() {
    return this;
  }
}

function toBase64(arrayBuffer: ArrayBuffer) {
  const uint8View = new Uint8Array(arrayBuffer);
  let binaryString = '';
  for (const byte of uint8View) {
    binaryString += String.fromCharCode(byte);
  }
  return btoa(binaryString);
}

function fromBase64(str: string) {
  const binaryString = atob(str);
  const bytes = Uint8Array.from(binaryString, (ch) => ch.charCodeAt(0));
  return bytes.buffer;
}

function combine(buffers: Array<ArrayBuffer>, totalLength: number) {
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
