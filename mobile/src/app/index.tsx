import { Linking, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { Stack } from 'expo-router';
import { Button, Paragraph, YStack } from 'tamagui';

import { ConversationalChat } from '../features/ConversationalChat';

function PageContent() {
  const [permission, requestPermission] = Audio.usePermissions();

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Paragraph>
          {t('We need microphone permission to enable conversational chat.')}
        </Paragraph>
        <Button
          onPress={() => {
            if (permission.canAskAgain) {
              void requestPermission();
            } else {
              openSettings();
            }
          }}
        >
          {t('Continue')}
        </Button>
      </YStack>
    );
  }

  return <ConversationalChat />;
}

export default function Page() {
  return (
    <>
      <Stack.Screen
        options={{
          title: t('Chat'),
          headerShown: false,
        }}
      />
      <PageContent />
    </>
  );
}

function openSettings() {
  if (Platform.OS === 'ios') {
    void Linking.openURL('app-settings:');
  } else {
    // TODO: Android
  }
}
