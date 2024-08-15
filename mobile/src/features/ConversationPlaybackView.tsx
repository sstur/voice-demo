import type { MutableRefObject } from 'react';
import { Square, X } from '@tamagui/lucide-icons';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';

import { IconButton } from '../components/IconButton';
import { PlaybackCaptionView } from './PlaybackCaptionView';
import type { Caption } from './types';

export function ConversationPlaybackView(props: {
  captionsRef: MutableRefObject<Array<Caption>>;
  playbackStartTimeRef: MutableRefObject<number | null>;
  onStop: () => void;
  onCancel: () => void;
}) {
  const { captionsRef, playbackStartTimeRef, onStop, onCancel } = props;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} justifyContent="center" gap={20}>
        <PlaybackCaptionView
          captionsRef={captionsRef}
          playbackStartTimeRef={playbackStartTimeRef}
        />
        <LottieView
          source={
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            require('../../assets/animation-voice.json')
          }
          style={{
            width: 400,
            height: 100,
            opacity: 0.7,
          }}
          autoPlay={true}
          loop={true}
        />
      </YStack>
      <YStack>
        <XStack justifyContent="space-around" alignItems="center" py={20}>
          <IconButton icon={Square} onPress={onStop} />
          <IconButton icon={X} onPress={onCancel} />
        </XStack>
      </YStack>
    </SafeAreaView>
  );
}
