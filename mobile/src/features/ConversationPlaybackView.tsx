import { useEffect, useState, type MutableRefObject } from 'react';
import { ArrowLeftRight, PhoneOff } from '@tamagui/lucide-icons';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spinner, YStack } from 'tamagui';

import { ActionButton } from '../components/ActionButton';
import { PlaybackCaptionView } from './PlaybackCaptionView';
import type { Caption } from './types';

export function ConversationPlaybackView(props: {
  captionsRef: MutableRefObject<Array<Caption>>;
  playbackStartTimeRef: MutableRefObject<number | null>;
  onStop: () => void;
  onCancel: () => void;
}) {
  const { captionsRef, playbackStartTimeRef, onStop, onCancel } = props;
  const [playbackStartedAt, setPlaybackStartedAt] = useState<number | null>(
    null,
  );
  useEffect(() => {
    const intervalId = setInterval(() => {
      const playbackStartTime = playbackStartTimeRef.current;
      if (playbackStartTime !== null) {
        setPlaybackStartedAt(playbackStartTime);
        clearInterval(intervalId);
      }
    }, 67);
    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} justifyContent="center" gap={20}>
        {playbackStartedAt !== null ? (
          <>
            <PlaybackCaptionView
              captionsRef={captionsRef}
              playbackStartedAt={playbackStartedAt}
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
          </>
        ) : (
          <Spinner />
        )}
      </YStack>
      <YStack alignItems="center" gap={20} py={20}>
        <ActionButton icon={ArrowLeftRight} onPress={onStop}>
          {t('Interrupt')}
        </ActionButton>
        <ActionButton icon={PhoneOff} onPress={onCancel} color="$red10Dark">
          {t('End Conversation')}
        </ActionButton>
      </YStack>
    </SafeAreaView>
  );
}
