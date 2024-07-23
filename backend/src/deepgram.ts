import type { LiveTranscriptionEvent } from '@deepgram/sdk';
import {
  createClient,
  LiveTranscriptionEvents,
  SOCKET_STATES,
} from '@deepgram/sdk';
import type { ICloseEvent } from 'websocket';

import { DEEPGRAM_KEY } from './support/constants';
import type { Logger } from './support/Logger';

const deepgram = createClient(DEEPGRAM_KEY);

export function createTranscriber(init: {
  logger: Logger;
  onText: (text: string, details: { isFinal: boolean }) => void;
  onError: (error: unknown) => void;
  onClose: (event: ICloseEvent) => void;
}) {
  const { logger, onText, onError, onClose } = init;

  const state = {
    isUpstreamInitialized: false,
  };

  const dataQueue: Array<Buffer | 'DONE'> = [];

  const flushQueue = () => {
    for (const message of dataQueue) {
      if (message === 'DONE') {
        dgConnection.requestClose();
        break;
      }
      dgConnection.send(message);
    }
    dataQueue.length = 0;
  };

  const send = (data: Buffer | 'DONE') => {
    dataQueue.push(data);
    if (
      state.isUpstreamInitialized &&
      dgConnection.getReadyState() === SOCKET_STATES.open
    ) {
      flushQueue();
    }
  };

  const dgConnection = deepgram.listen.live({
    interim_results: true,
    model: 'nova-2-conversationalai',
    smart_format: true,
  });

  dgConnection.on('open', () => {
    logger.log('Deepgram open');
    state.isUpstreamInitialized = true;
    flushQueue();
  });

  dgConnection.on('close', (event: ICloseEvent) => {
    const { code, reason, wasClean } = event;
    logger.log('Deepgram closed', { code, reason, wasClean });
    onClose(event);
  });

  dgConnection.on('error', (event) => {
    logger.warn('dgConnection received error:', toError(event));
    onError(event);
  });

  dgConnection.on(
    LiveTranscriptionEvents.Transcript,
    (data: LiveTranscriptionEvent) => {
      const isFinal = data.is_final ?? false;
      for (const { transcript } of data.channel.alternatives) {
        if (typeof transcript === 'string') {
          const text = transcript.trim();
          onText(text, { isFinal });
        }
      }
    },
  );

  return {
    send: (data: Buffer) => {
      send(data);
    },
    done: () => {
      send('DONE');
    },
    terminate: () => {
      // TODO: This should hard-close the connection
      if (dgConnection.getReadyState() === SOCKET_STATES.open) {
        dgConnection.requestClose();
      }
    },
  };
}

/**
 * The parameter sent to the onError handler for Deepgram can be any value, but is likely a ErrorEvent.
 */
function toError(input: unknown): Error {
  const object = Object(input);
  if (object.__proto__?.constructor.name === 'ErrorEvent') {
    return toError(object.error);
  }
  return input instanceof Error ? input : new Error(String(input));
}
