import { MoreVertical, Play } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Image, Paragraph, ScrollView, XStack, YStack } from 'tamagui';

import imageCircles from '../../assets/circles.png';
import { ActionButton } from '../components/ActionButton';
import { DropdownMenu } from '../components/DropdownMenu';
import type { ConversationMessage } from './types';

type ConversationOptions = {
  visionEnabled: boolean;
};

export function ConversationIdleView(props: {
  lastConversation: Array<ConversationMessage> | undefined;
  onClearConversationPress: () => void;
  onStartConversationPress: (options: ConversationOptions) => void;
}) {
  const {
    lastConversation,
    onClearConversationPress,
    onStartConversationPress,
  } = props;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack>
        <XStack justifyContent="flex-end">
          <DropdownMenu
            trigger={
              <Button
                chromeless
                p={0}
                w={42}
                h={42}
                borderRadius={21}
                icon={<MoreVertical size="$1.5" />}
              />
            }
            items={[
              {
                label: t('Vision'),
                onClick: () =>
                  onStartConversationPress({ visionEnabled: true }),
              },
              {
                label: t('Clear Conversation'),
                onClick: () => onClearConversationPress(),
              },
            ]}
          />
        </XStack>
      </YStack>
      <YStack flex={1} justifyContent="center">
        {lastConversation && lastConversation.length ? (
          <ScrollView flex={1}>
            <YStack gap={20} py={20}>
              {lastConversation.map((message, i) => (
                <MessageView key={i} message={message} />
              ))}
            </YStack>
          </ScrollView>
        ) : (
          <YStack width="100%" aspectRatio={1} padding={20}>
            <Image
              width="100%"
              height="100%"
              opacity={0.6}
              source={imageCircles}
            />
          </YStack>
        )}
      </YStack>
      <YStack alignItems="center" py={30}>
        <ActionButton
          icon={Play}
          onPress={() => onStartConversationPress({ visionEnabled: false })}
        >
          {t('Start Conversation')}
        </ActionButton>
      </YStack>
    </SafeAreaView>
  );
}

function MessageView(props: { message: ConversationMessage }) {
  const { role, content } = props.message;
  return (
    <XStack
      px={20}
      justifyContent={role === 'ASSISTANT' ? 'flex-start' : 'flex-end'}
    >
      <YStack
        maxWidth="80%"
        py="$3"
        px="$4"
        borderRadius={10}
        backgroundColor={role === 'ASSISTANT' ? '$gray5Dark' : '#1a6679'}
      >
        <Paragraph fontSize="$5">{content}</Paragraph>
      </YStack>
    </XStack>
  );
}
