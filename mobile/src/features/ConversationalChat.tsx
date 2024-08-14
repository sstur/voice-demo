import { useEffect, useReducer, useState } from 'react';
import { Play, Square, X } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import imageCircles from '../../assets/circles.png';
import {
  Button,
  Image,
  Paragraph,
  styled,
  XStack,
  YStack,
} from '../components/core';
import { useAudioPlayback } from '../context/AudioPlayback';
import { ConversationController } from './conversation';

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
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Paragraph>{t('Listening...')}</Paragraph>
      </YStack>
      <YStack>
        <XStack justifyContent="center" alignItems="center" gap={20} py={20}>
          <IconButton icon={Square} onPress={props.onStop} />
          <IconButton icon={X} onPress={props.onCancel} />
        </XStack>
      </YStack>
    </SafeAreaView>
  );
}

function ConversationPlaybackView(props: {
  onStop: () => void;
  onCancel: () => void;
}) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Paragraph>{t('Speaking...')}</Paragraph>
      </YStack>
      <YStack>
        <XStack justifyContent="center" alignItems="center" gap={20} py={20}>
          <IconButton icon={Square} onPress={props.onStop} />
          <IconButton icon={X} onPress={props.onCancel} />
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

  const isTalking = () => {
    if (state.name === 'CONVERSATION_ONGOING') {
      const { controller } = state;
      if (controller.state.name === 'RUNNING') {
        const { turn } = controller.state;
        return turn.name === 'USER_SPEAKING';
      }
    }
    return false;
  };

  return (
    <YStack flex={1}>
      {state.name === 'IDLE' ? (
        <ConversationIdleView
          onPress={() => {
            const controller = new ConversationController({
              audioPlaybackContext,
            });
            setState({ name: 'CONVERSATION_ONGOING', controller });
            void controller.start();
          }}
        />
      ) : isTalking() ? (
        <ConversationListeningView
          onStop={() => {
            state.controller.changeTurn();
          }}
          onCancel={() => {
            state.controller.terminate();
            setState({ name: 'IDLE' });
          }}
        />
      ) : (
        <ConversationPlaybackView
          onStop={() => {
            state.controller.changeTurn();
          }}
          onCancel={() => {
            state.controller.terminate();
            setState({ name: 'IDLE' });
          }}
        />
      )}
    </YStack>
  );
}
