import { Home } from '@tamagui/lucide-icons';

import { Button, VStack } from '../components/core';

export default function App() {
  return (
    <VStack flex={1} justifyContent="center" alignItems="center">
      <Button icon={<Home />}>{t('Hello world!')}</Button>
    </VStack>
  );
}
