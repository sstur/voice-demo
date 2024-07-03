import { Button, YStack } from 'tamagui';

export default function App() {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center">
      <Button>{t('Hello world!')}</Button>
    </YStack>
  );
}
