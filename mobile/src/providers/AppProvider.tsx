import type { ReactNode } from 'react';

import { FontProvider } from './FontProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { ReactQueryProvider } from './ReactQueryProvider';
import { ThemeProvider } from './ThemeProvider';

type Props = {
  onInitialized: () => void;
  children: ReactNode;
};

export function AppProvider(props: Props) {
  const { onInitialized, children } = props;
  return (
    <FontProvider>
      <ThemeProvider>
        <LocalStorageProvider onInitialized={onInitialized}>
          <ReactQueryProvider>{children}</ReactQueryProvider>
        </LocalStorageProvider>
      </ThemeProvider>
    </FontProvider>
  );
}
