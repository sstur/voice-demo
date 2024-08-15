import { useEffect, useState, type MutableRefObject } from 'react';
import { Square, X } from '@tamagui/lucide-icons';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spinner, XStack, YStack } from 'tamagui';

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
      <YStack>
        <XStack justifyContent="space-around" alignItems="center" py={20}>
          <IconButton icon={Square} onPress={onStop} />
          <IconButton icon={X} onPress={onCancel} />
        </XStack>
      </YStack>
    </SafeAreaView>
  );
}
