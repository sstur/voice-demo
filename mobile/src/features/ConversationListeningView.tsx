import { ArrowLeftRight, PhoneOff } from '@tamagui/lucide-icons';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

import { ActionButton } from '../components/ActionButton';
import { CameraPermission } from '../components/CameraPermission';
import type { ImageResult } from './types';
import { VisionView } from './VisionView';

type Props = {
  visionEnabled: boolean;
  onStop: () => void;
  onCancel: () => void;
  onPhoto: (photo: ImageResult) => void;
};

function ConversationListeningViewContent(props: Props) {
  const { visionEnabled, onStop, onCancel, onPhoto } = props;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} justifyContent="center" alignItems="center">
        {/* <Paragraph>{t('Listening...')}</Paragraph> */}
        {visionEnabled ? (
          <VisionView style={{ width: 180, height: 320 }} onPhoto={onPhoto} />
        ) : (
          <LottieView
            source={
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              require('../../assets/animation-microphone.json')
            }
            style={{
              width: 400,
              height: 400,
            }}
            autoPlay={true}
            loop={true}
          />
        )}
      </YStack>
      <YStack alignItems="center" gap={20} py={20}>
        <ActionButton icon={ArrowLeftRight} onPress={onStop}>
          {t('Done Talking')}
        </ActionButton>
        <ActionButton icon={PhoneOff} onPress={onCancel} color="$red10Dark">
          {t('End Conversation')}
        </ActionButton>
      </YStack>
    </SafeAreaView>
  );
}

export function ConversationListeningView(props: Props) {
  const { visionEnabled } = props;
  return visionEnabled ? (
    <CameraPermission
      message={t('Camera permission is needed to enable vision mode.')}
    >
      <ConversationListeningViewContent {...props} />
    </CameraPermission>
  ) : (
    <ConversationListeningViewContent {...props} />
  );
}
