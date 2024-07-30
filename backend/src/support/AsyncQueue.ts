import { EventEmitter } from 'events';

type EventMap = {
  read: [];
  write: [];
  close: [];
};

export class AsyncQueue<T> implements AsyncIterable<T> {
  private chunks: Array<T> = [];
  private isClosed = false;
  emitter = new EventEmitter<EventMap>();

  private async read(index: number): Promise<IteratorResult<T, undefined>> {
    const { chunks } = this;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
    while (true) {
      const value = chunks[index];
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
    let index = 0;
    const iterator = {
      next: async (): Promise<IteratorResult<T, undefined>> => {
        return await this.read(index++);
      },
      [Symbol.asyncIterator]: () => iterator,
    };
    return iterator;
  }
}
