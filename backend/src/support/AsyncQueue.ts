import { EventEmitter } from 'events';

type EventMap = {
  read: [];
  write: [];
  close: [];
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
        this.emitter.emit('read');
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
    // Emitting "write" here in case read above is waiting for it
    this.emitter.emit('write');
    this.emitter.emit('close');
  }

  [Symbol.asyncIterator]() {
    return this;
  }
}
