/**
 * Allows us to share state between one more more React components and outside of React.
 */
import { useEffect, useState } from 'react';

type Listener<T> = (state: T) => void;

class SharedState<T> {
  private currentState: T;
  private listeners = new Set<Listener<T>>();

  constructor(initialState: T) {
    this.currentState = initialState;
  }

  get current() {
    return this.currentState;
  }

  set(state: T) {
    this.currentState = state;
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  subscribe(listener: (state: T) => void) {
    this.listeners.add(listener);
    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
      },
    };
  }
}

export function createSharedState<T>(getInitialState: () => T) {
  const initialState = getInitialState();
  return new SharedState(initialState);
}

export function useSharedState<T>(sharedState: SharedState<T>): T {
  const [localState, setLocalState] = useState<T>(() => sharedState.current);
  useEffect(() => {
    setLocalState(sharedState.current);
    const subscription = sharedState.subscribe((state) => setLocalState(state));
    return () => subscription.unsubscribe();
  }, [sharedState]);
  return localState;
}
