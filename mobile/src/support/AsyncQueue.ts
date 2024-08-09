import { EventEmitter } from './EventEmitter';

type EventMap = {
  write: [];
};

export class AsyncQueue<T> implements AsyncIterableIterator<T> {
  private chunks: Array<T> = [];
  private isClosed = false;
  private emitter = new EventEmitter<EventMap>();

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
      await new Promise<void>((resolve) => this.emitter.once('write', resolve));
    }
    return { done: true, value: undefined };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async write(value: T) {
    if (!this.isClosed) {
      this.chunks.push(value);
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
