import { SplashScreen, Stack } from 'expo-router';
import { useTheme } from 'tamagui';

import { AppProvider } from '../providers/AppProvider';

void SplashScreen.preventAutoHideAsync();

function RootContent() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.color.get(),
        headerBackTitleVisible: false,
        contentStyle: {
          backgroundColor: theme.background.get(),
        },
      }}
    />
  );
}

export default function Layout() {
  return (
    <AppProvider onInitialized={() => SplashScreen.hideAsync()}>
      <RootContent />
    </AppProvider>
  );
}
