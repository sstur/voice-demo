import type { ReactNode } from 'react';
import { Linking } from 'react-native';
import { Camera, Settings } from '@tamagui/lucide-icons';
import { useCameraPermissions } from 'expo-camera';
import { Paragraph, Spinner, YStack } from 'tamagui';

import { ActionButton } from './ActionButton';

export function CameraPermission(props: {
  message: string;
  children: ReactNode;
}) {
  const [permission, requestPermission] = useCameraPermissions();

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
          <ActionButton icon={Camera} onPress={() => requestPermission()}>
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
