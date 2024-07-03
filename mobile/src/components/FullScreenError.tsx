import { SafeAreaView } from 'react-native';

import { Button, Text, VStack } from './core';

type Props = {
  error: unknown;
  onRetryPress?: () => void;
};

export function FullScreenError(props: Props) {
  const { error, onRetryPress } = props;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <VStack p={20} gap={20}>
        <Text>{String(error)}</Text>
        {onRetryPress ? (
          <Button onPress={onRetryPress}>{t('Retry')}</Button>
        ) : null}
      </VStack>
    </SafeAreaView>
  );
}
