import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { FullScreenError } from '../components/FullScreenError';
import { createContext } from '../support/createContext';
import { getLocalStorage } from '../support/localStorage';

type LoadState =
  | { state: 'LOADING' }
  | { state: 'LOADED'; localStorage: Storage }
  | { state: 'ERROR'; error: unknown };

type Props = {
  onInitialized: () => void;
  children: ReactNode;
};

const [useLocalStorage, ContextProvider] =
  createContext<Storage>('LocalStorage');

export { useLocalStorage };

export function LocalStorageProvider(props: Props) {
  const { onInitialized, children } = props;
  const [loadState, setLoadState] = useState<LoadState>({ state: 'LOADING' });
  useEffect(() => {
    getLocalStorage()
      .then((localStorage) => {
        setLoadState({ state: 'LOADED', localStorage });
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.warn('Error loading from AsyncStorage:', error);
        setLoadState({ state: 'ERROR', error });
      })
      .finally(() => {
        // Hide the splash screen
        onInitialized();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (loadState.state === 'ERROR') {
    return <FullScreenError error={loadState.error} />;
  }
  if (loadState.state === 'LOADING') {
    return null;
  }
  const { localStorage } = loadState;
  return <ContextProvider value={localStorage}>{children}</ContextProvider>;
}
