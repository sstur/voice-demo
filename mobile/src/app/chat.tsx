import { Linking, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { Stack } from 'expo-router';

import { Button, Text, VStack } from '../components/core';
import { ConversationalChat } from '../features/ConversationalChat';

function PageContent() {
  const [permission, requestPermission] = Audio.usePermissions();

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <VStack flex={1} justifyContent="center" alignItems="center">
        <Text>
          {t('We need microphone permission to enable conversational chat.')}
        </Text>
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
      </VStack>
    );
  }

  return <ConversationalChat />;
}

export default function Page() {
  return (
    <>
      <Stack.Screen options={{ title: t('Chat') }} />
      <VStack flex={1} bc="white">
        <PageContent />
      </VStack>
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
