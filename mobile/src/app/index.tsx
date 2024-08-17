import { Stack } from 'expo-router';

import { MicrophonePermission } from '../components/MicrophonePermission';
import { ConversationHome } from '../features/ConversationHome';

export default function Page() {
  return (
    <>
      <Stack.Screen
        options={{
          title: t('Chat'),
          headerShown: false,
        }}
      />
      <MicrophonePermission
        message={t(
          'Microphone permission is needed to enable conversational chat.',
        )}
      >
        <ConversationHome />
      </MicrophonePermission>
    </>
  );
}
