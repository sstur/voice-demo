import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import { TamaguiProvider, Theme } from 'tamagui';

import config from '../config/tamagui.config';

export function ThemeProvider(props: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  return (
    <TamaguiProvider config={config}>
      <Theme name={colorScheme === 'dark' ? 'dark' : 'light'}>
        <NavigationThemeProvider
          value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
        >
          {props.children}
        </NavigationThemeProvider>
      </Theme>
    </TamaguiProvider>
  );
}
