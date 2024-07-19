import { Button, Text, VStack } from '../components/core';

export function ConversationalChat() {
  return (
    <VStack flex={1} justifyContent="center" alignItems="center">
      <Text>{t('Ready')}</Text>
      <Button>{t('Start')}</Button>
    </VStack>
  );
}
