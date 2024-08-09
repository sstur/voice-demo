type Listener<T extends Array<unknown>> = (...args: T) => void;

export class EventEmitter<
  E extends Record<string, Array<unknown>> = Record<never, []>,
> {
  private listenerMap: { [K in keyof E]?: Set<Listener<E[K]>> } = {};

  on<K extends keyof E>(key: K, listener: Listener<E[K]>) {
    return this.addListener(key, listener);
  }

  addListener<K extends keyof E>(key: K, listener: Listener<E[K]>) {
    const { listenerMap } = this;
    const listeners = listenerMap[key] ?? (listenerMap[key] = new Set());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  once<K extends keyof E>(key: K, listener: Listener<E[K]>) {
    const remove = this.addListener(key, (...args) => {
      remove();
      listener(...args);
    });
  }

  off<K extends keyof E>(key: K, listener: Listener<E[K]>) {
    this.removeListener(key, listener);
  }

  removeListener<K extends keyof E>(key: K, listener: Listener<E[K]>) {
    const listeners = this.listenerMap[key];
    if (listeners) {
      listeners.delete(listener);
    }
  }

  emit<K extends keyof E>(key: K, ...args: E[K]) {
    const listeners: Set<Listener<E[K]>> | undefined = this.listenerMap[key];
    if (listeners) {
      for (const listener of listeners) {
        listener(...args);
      }
    }
  }
}
