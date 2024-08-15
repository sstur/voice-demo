import { useEffect, useReducer, useState } from 'react';

import { useAudioPlayback } from '../context/AudioPlayback';
import { ConversationController } from './conversation';
import { ConversationIdleView } from './ConversationIdleView';
import { ConversationListeningView } from './ConversationListeningView';
import { ConversationPlaybackView } from './ConversationPlaybackView';
import type { ConversationMessage } from './types';

type State =
  | { name: 'IDLE'; lastConversation?: Array<ConversationMessage> }
  | {
      name: 'CONVERSATION_ONGOING';
      controller: ConversationController;
      visionEnabled: boolean;
    };

export function ConversationHome() {
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
        lastConversation={state.lastConversation}
        onClearConversationPress={() => {
          setState({ name: 'IDLE' });
        }}
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
          setState({ name: 'IDLE', lastConversation: controller.conversation });
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
          setState({ name: 'IDLE', lastConversation: controller.conversation });
        }}
      />
    );
  }
}
