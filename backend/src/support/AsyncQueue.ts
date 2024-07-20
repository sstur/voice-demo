import { EventEmitter } from 'events';

type EventMap = {
  change: [];
};

export class AsyncQueue<T> implements AsyncIterator<T, undefined> {
  private queue: Array<T> = [];
  private isClosed = false;
  private emitter = new EventEmitter<EventMap>();

  // eslint-disable-next-line @typescript-eslint/require-await
  async write(value: T) {
    if (!this.isClosed) {
      this.queue.push(value);
      this.emitter.emit('change');
    }
  }

  close() {
    this.isClosed = true;
    this.emitter.emit('change');
  }

  async next(): Promise<IteratorResult<T, undefined>> {
    const { queue } = this;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
    while (true) {
      const value = queue.shift();
      if (value !== undefined) {
        return { done: false, value };
      }
      if (this.isClosed) {
        break;
      }
      await new Promise<void>((resolve) =>
        this.emitter.once('change', resolve),
      );
    }
    return { done: true, value: undefined };
  }
}
