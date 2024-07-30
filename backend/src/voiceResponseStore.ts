import { AsyncQueue } from './support/AsyncQueue';

const CLEANUP_TIMEOUT = 30_000;

const map = new Map<string, AsyncQueue<Buffer>>();

export const voiceResponseStore = {
  get: (id: string) => {
    return map.get(id);
  },
  create: (id: string) => {
    const asyncQueue = new AsyncQueue<Buffer>();
    // When writing is complete, set a timeout to cleanup after some amount of inactivity
    asyncQueue.emitter.once('close', () => {
      const cleanup = () => map.delete(id);
      let timeout = setTimeout(cleanup, CLEANUP_TIMEOUT);
      asyncQueue.emitter.on('read', () => {
        clearTimeout(timeout);
        timeout = setTimeout(cleanup, CLEANUP_TIMEOUT);
      });
    });
    map.set(id, asyncQueue);
    return asyncQueue;
  },
};
