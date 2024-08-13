import { useEffect, useReducer, useState } from 'react';

import { Button, Text, VStack } from '../components/core';
import { useAudioPlayback } from '../context/AudioPlayback';
import { ConversationController } from './conversation';

type State =
  | { name: 'IDLE' }
  | { name: 'CONVERSATION_ONGOING'; controller: ConversationController };

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
    <VStack flex={1} justifyContent="center" alignItems="center">
      {state.name === 'IDLE' ? (
        <>
          <Text>{t('Ready')}</Text>
          <Button
            onPress={() => {
              const controller = new ConversationController({
                audioPlaybackContext,
              });
              setState({ name: 'CONVERSATION_ONGOING', controller });
              void controller.start();
            }}
          >
            {t('Start')}
          </Button>
        </>
      ) : (
        <>
          <Text>{t('Running...')}</Text>
          {isTalking() ? (
            <Button
              onPress={() => {
                const controller = new ConversationController({
                  audioPlaybackContext,
                });
                setState({ name: 'CONVERSATION_ONGOING', controller });
                void controller.start();
              }}
            >
              {t('Done Talking')}
            </Button>
          ) : null}
        </>
      )}
    </VStack>
  );
}
