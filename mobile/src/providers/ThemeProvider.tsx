import type { ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import { TamaguiProvider, Theme } from 'tamagui';

import config from '../config/tamagui.config';

export function ThemeProvider(props: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  // TODO: Use a constant here or get it from our theme config
  const backgroundColor = colorScheme === 'dark' ? '#0E1116' : 'white';
  return (
    <TamaguiProvider config={config}>
      <Theme name={colorScheme === 'dark' ? 'dark' : 'light'}>
        <NavigationThemeProvider
          value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
        >
          <View
            style={{
              flex: 1,
              backgroundColor,
            }}
          >
            {props.children}
          </View>
        </NavigationThemeProvider>
      </Theme>
    </TamaguiProvider>
  );
}
