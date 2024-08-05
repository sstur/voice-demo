import { EventEmitter } from './EventEmitter';

type EventMap = {
  change: [];
};

/**
 * This is pretty hacky. Migrate to a better state management solution.
 */
export class StateClass {
  emitter = new EventEmitter<EventMap>();

  constructor() {
    let state: unknown = undefined;
    Object.defineProperty(this, 'state', {
      get: () => state,
      set: (newState: unknown) => {
        state = newState;
        this.emitter.emit('change');
      },
      enumerable: true,
    });
  }
}
