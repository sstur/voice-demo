import type { AsyncQueue } from './support/AsyncQueue';

export const voiceResponseStore = new Map<string, AsyncQueue<Buffer>>();
