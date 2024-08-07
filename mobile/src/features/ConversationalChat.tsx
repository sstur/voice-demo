import { useState } from 'react';
import type { WebBrowserResult } from 'expo-web-browser';
import { openBrowserAsync } from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

import { Button, Text } from '../components/core';

export function ConversationalChat() {
  const [result, setResult] = useState<WebBrowserResult | null>(null);
  const safeAreaInsets = useSafeAreaInsets();

  const handlePressButtonAsync = async () => {
    const result = await openBrowserAsync(
      'https://aura-tts-demo.deepgram.com/',
    );
    setResult(result);
  };
  return (
    <YStack flex={1} ai="center" jc="center" pt={safeAreaInsets.top}>
      <Button onPress={handlePressButtonAsync}>{t('Open Web Browser')}</Button>
      <Text>{result && JSON.stringify(result)}</Text>
    </YStack>
  );
}
