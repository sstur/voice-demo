import { SafeAreaView } from 'react-native';

import { Button, Paragraph, YStack } from './core';

type Props = {
  error: unknown;
  onRetryPress?: () => void;
};

export function FullScreenError(props: Props) {
  const { error, onRetryPress } = props;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack p={20} gap={20}>
        <Paragraph>{String(error)}</Paragraph>
        {onRetryPress ? (
          <Button onPress={onRetryPress}>{t('Retry')}</Button>
        ) : null}
      </YStack>
    </SafeAreaView>
  );
}
