import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { ThemeProvider } from './ThemeProvider';

type Props = {
  onInitialized: () => void;
  children: ReactNode;
};

export function AppProvider(props: Props) {
  const { onInitialized, children } = props;
  const [isLoaded, setLoaded] = useState(false);
  useEffect(() => {
    // TODO: Load fonts or whatever
    setLoaded(true);
    onInitialized();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!isLoaded) {
    return null;
  }
  return <ThemeProvider>{children}</ThemeProvider>;
}
