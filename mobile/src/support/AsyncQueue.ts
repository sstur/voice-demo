// TODO: Sync this with the other one
import { EventEmitter } from './EventEmitter';

type EventMap = {
  change: [];
};

const WRITE_TIMEOUT = 5000;

class WriteTimeoutError extends Error {
  constructor() {
    super('Timeout exceeded waiting for write to AsyncQueue');
  }
}

export class AsyncQueue<T> implements AsyncIterableIterator<T> {
  private chunks: Array<T> = [];
  private isClosed = false;
  private emitter = new EventEmitter<EventMap>();

  private async waitForChange() {
    let timeout: TimeoutId | undefined;
    await Promise.race([
      new Promise<void>((resolve) => {
        this.emitter.once('change', () => {
          clearTimeout(timeout);
          resolve();
        });
      }),
      new Promise<void>((resolve, reject) => {
        timeout = setTimeout(
          () => reject(new WriteTimeoutError()),
          WRITE_TIMEOUT,
        );
      }),
    ]);
  }

  async next(): Promise<IteratorResult<T, undefined>> {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
    while (true) {
      const value = this.chunks.shift();
      if (value !== undefined) {
        return { done: false, value };
      }
      if (this.isClosed) {
        break;
      }
      await this.waitForChange();
    }
    return { done: true, value: undefined };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async write(value: T) {
    if (!this.isClosed) {
      this.chunks.push(value);
      this.emitter.emit('change');
    }
  }

  close() {
    this.isClosed = true;
    // Emitting "change" here in case next above is waiting for it
    this.emitter.emit('change');
  }

  [Symbol.asyncIterator]() {
    return this;
  }
}
