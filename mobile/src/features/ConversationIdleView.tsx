import { MoreVertical, Play } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Image, XStack, YStack } from 'tamagui';

import imageCircles from '../../assets/circles.png';
import { DropdownMenu } from '../components/DropdownMenu';

type ConversationOptions = {
  visionEnabled: boolean;
};

export function ConversationIdleView(props: {
  onStartConversationPress: (options: ConversationOptions) => void;
}) {
  const { onStartConversationPress } = props;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1}>
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
            ]}
          />
        </XStack>
      </YStack>
      <YStack width="100%" aspectRatio={1} padding={20}>
        <Image width="100%" height="100%" opacity={0.6} source={imageCircles} />
      </YStack>
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Button
          icon={Play}
          onPress={() => onStartConversationPress({ visionEnabled: false })}
        >
          {t('Start Conversation')}
        </Button>
      </YStack>
    </SafeAreaView>
  );
}
