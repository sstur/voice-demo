import type { ReactNode } from 'react';

import { AudioPlaybackProvider } from './AudioPlaybackProvider';
import { FontProvider } from './FontProvider';
import { ReactQueryProvider } from './ReactQueryProvider';
import { ThemeProvider } from './ThemeProvider';

type Props = {
  children: ReactNode;
};

export function AppProvider(props: Props) {
  const { children } = props;
  return (
    <FontProvider>
      <ThemeProvider>
        <ReactQueryProvider>
          <AudioPlaybackProvider>{children}</AudioPlaybackProvider>
        </ReactQueryProvider>
      </ThemeProvider>
    </FontProvider>
  );
}
