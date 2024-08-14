import type { MutableRefObject } from 'react';
import { useEffect, useReducer, useState } from 'react';
import { Play, Square, X } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Image, Paragraph, styled, XStack, YStack } from 'tamagui';

import imageCircles from '../../assets/circles.png';
import { useAudioPlayback } from '../context/AudioPlayback';
import { ConversationController } from './conversation';
import { PlaybackCaptionView } from './PlaybackCaptionView';
import type { Caption } from './types';
import { VisionView } from './VisionView';

type State =
  | { name: 'IDLE' }
  | { name: 'CONVERSATION_ONGOING'; controller: ConversationController };

const IconButton = styled(Button, {
  borderRadius: 32,
  padding: 0,
  size: '$8',
  width: 64,
  height: 64,
});

function ConversationIdleView(props: { onPress: () => void }) {
  return (
    <YStack flex={1}>
      <YStack flex={1} />
      <YStack width="100%" aspectRatio={1} padding={20}>
        <Image width="100%" height="100%" opacity={0.6} source={imageCircles} />
      </YStack>
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Button icon={Play} onPress={props.onPress}>
          {t('Start Conversation')}
        </Button>
      </YStack>
    </YStack>
  );
}

function ConversationListeningView(props: {
  onStop: () => void;
  onCancel: () => void;
}) {
  const { onStop, onCancel } = props;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} justifyContent="center" alignItems="center">
        {/* <Paragraph>{t('Listening...')}</Paragraph> */}
        <VisionView
          style={{ width: 180, height: 320 }}
          onPhoto={(photo) => {
            const { uri, width, height, base64 } = photo;
            console.log('Took photo:', {
              uri,
              width,
              height,
              base64: base64?.length,
            });
          }}
        />
      </YStack>
      <YStack>
        <XStack justifyContent="center" alignItems="center" gap={20} py={20}>
          <IconButton icon={Square} onPress={onStop} />
          <IconButton icon={X} onPress={onCancel} />
        </XStack>
      </YStack>
    </SafeAreaView>
  );
}

function ConversationPlaybackView(props: {
  captionsRef: MutableRefObject<Array<Caption>>;
  playbackStartTimeRef: MutableRefObject<number | null>;
  onStop: () => void;
  onCancel: () => void;
}) {
  const { captionsRef, playbackStartTimeRef, onStop, onCancel } = props;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} justifyContent="center">
        <PlaybackCaptionView
          captionsRef={captionsRef}
          playbackStartTimeRef={playbackStartTimeRef}
        />
      </YStack>
      <YStack>
        <XStack justifyContent="center" alignItems="center" gap={20} py={20}>
          <IconButton icon={Square} onPress={onStop} />
          <IconButton icon={X} onPress={onCancel} />
        </XStack>
      </YStack>
    </SafeAreaView>
  );
}

export function ConversationalChat() {
  const audioPlaybackContext = useAudioPlayback();
  const [state, setState] = useState<State>({ name: 'IDLE' });
  const [_, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Subscribe to updates on the conversation controller
  useEffect(() => {
    if (state.name === 'CONVERSATION_ONGOING') {
      const { controller } = state;
      controller.emitter.on('change', forceUpdate);
      return () => {
        controller.emitter.off('change', forceUpdate);
      };
    }
  }, [state, forceUpdate]);

  if (state.name === 'IDLE') {
    return (
      <ConversationIdleView
        onPress={() => {
          const controller = new ConversationController({
            audioPlaybackContext,
          });
          setState({ name: 'CONVERSATION_ONGOING', controller });
          void controller.start();
        }}
      />
    );
  }

  const { controller } = state;

  if (controller.state.name !== 'RUNNING') {
    // TODO: Show relevant UI, e.g. loading indicator
    return null;
  }

  const { turn } = controller.state;

  if (turn.name === 'USER_SPEAKING') {
    return (
      <ConversationListeningView
        onStop={() => {
          state.controller.changeTurn();
        }}
        onCancel={() => {
          state.controller.terminate();
          setState({ name: 'IDLE' });
        }}
      />
    );
  } else {
    return (
      <ConversationPlaybackView
        captionsRef={turn.playbackController.captionsRef}
        playbackStartTimeRef={turn.playbackController.playbackStartTimeRef}
        onStop={() => {
          state.controller.changeTurn();
        }}
        onCancel={() => {
          state.controller.terminate();
          setState({ name: 'IDLE' });
        }}
      />
    );
  }
}
