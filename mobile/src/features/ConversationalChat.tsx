import type { MutableRefObject } from 'react';
import { useEffect, useReducer, useState } from 'react';
import { MoreVertical, Play, Square, X } from '@tamagui/lucide-icons';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Image, styled, XStack, YStack } from 'tamagui';

import imageCircles from '../../assets/circles.png';
import { DropdownMenu } from '../components/DropdownMenu';
import { useAudioPlayback } from '../context/AudioPlayback';
import { ConversationController } from './conversation';
import { PlaybackCaptionView } from './PlaybackCaptionView';
import type { Caption, ImageResult } from './types';
import { VisionView } from './VisionView';

type State =
  | { name: 'IDLE' }
  | {
      name: 'CONVERSATION_ONGOING';
      controller: ConversationController;
      visionEnabled: boolean;
    };

type ConversationOptions = {
  visionEnabled: boolean;
};

const IconButton = styled(Button, {
  borderRadius: 32,
  padding: 0,
  size: '$8',
  width: 64,
  height: 64,
});

function ConversationIdleView(props: {
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

function ConversationListeningView(props: {
  visionEnabled: boolean;
  onStop: () => void;
  onCancel: () => void;
  onPhoto: (photo: ImageResult) => void;
}) {
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
        onStartConversationPress={({ visionEnabled }) => {
          const controller = new ConversationController({
            audioPlaybackContext,
          });
          setState({ name: 'CONVERSATION_ONGOING', controller, visionEnabled });
          void controller.start();
        }}
      />
    );
  }

  const { controller } = state;
  const controllerState = controller.state;

  if (controllerState.name !== 'RUNNING') {
    // TODO: Show relevant UI, e.g. loading indicator
    return null;
  }

  const { turn } = controllerState;

  if (turn.name === 'USER_SPEAKING') {
    return (
      <ConversationListeningView
        visionEnabled={state.visionEnabled}
        onStop={() => {
          controller.changeTurn();
        }}
        onCancel={() => {
          controller.terminate();
          setState({ name: 'IDLE' });
        }}
        onPhoto={(photo) => {
          const { width, height, base64 } = photo;
          void controllerState.socket.send({
            type: 'PHOTO',
            width,
            height,
            dataUri: 'data:image/jpeg;base64,' + base64,
          });
        }}
      />
    );
  } else {
    return (
      <ConversationPlaybackView
        captionsRef={turn.playbackController.captionsRef}
        playbackStartTimeRef={turn.playbackController.playbackStartTimeRef}
        onStop={() => {
          controller.changeTurn();
        }}
        onCancel={() => {
          controller.terminate();
          setState({ name: 'IDLE' });
        }}
      />
    );
  }
}
