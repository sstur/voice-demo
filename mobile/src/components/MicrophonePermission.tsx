import type { ReactNode } from 'react';
import { Linking } from 'react-native';
import { Mic, Settings } from '@tamagui/lucide-icons';
import { Audio } from 'expo-av';
import { Paragraph, Spinner, YStack } from 'tamagui';

import { ActionButton } from './ActionButton';

export function MicrophonePermission(props: {
  message: string;
  children: ReactNode;
}) {
  const [permission, requestPermission] = Audio.usePermissions();

  if (!permission) {
    return (
      <YStack flex={1} jc="center" ai="center">
        <Spinner />
      </YStack>
    );
  }

  if (!permission.granted) {
    return (
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        p={20}
        gap={20}
      >
        <Paragraph size="$5" textAlign="center">
          {props.message}
        </Paragraph>
        {permission.canAskAgain ? (
          <ActionButton icon={Mic} onPress={() => requestPermission()}>
            {t('Continue')}
          </ActionButton>
        ) : (
          <ActionButton icon={Settings} onPress={() => Linking.openSettings()}>
            {t('Settings')}
          </ActionButton>
        )}
      </YStack>
    );
  }

  return <>{props.children}</>;
}
