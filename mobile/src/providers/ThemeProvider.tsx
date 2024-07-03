import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../config/tamagui.config';

export function ThemeProvider(props: { children: ReactNode }) {
  return <TamaguiProvider config={config}>{props.children}</TamaguiProvider>;
}
