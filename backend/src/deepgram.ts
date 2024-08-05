import { WebSocket } from 'ws';

import { DEEPGRAM_KEY, DEEPGRAM_WSS_URL } from './support/constants';
import { logger } from './support/Logger';
import { once } from './support/once';
import { parseMessage } from './support/parseMessage';

// TODO: Proper state
export function createTranscriber(init: {
  onText: (text: string) => void;
  onError: (error: Error) => void;
  onDone: () => void;
}) {
  const { onText } = init;
  const onDone = once(init.onDone);
  const onError = once(init.onError);

  const textFragments: Array<string> = [];
  const dataQueue: Array<Buffer | Record<string, unknown>> = [];

  const flushQueue = () => {
    for (const message of dataQueue) {
      if (Buffer.isBuffer(message)) {
        ws.send(message);
      } else {
        ws.send(JSON.stringify(message));
      }
    }
    dataQueue.length = 0;
  };

  const send = (data: Buffer | Record<string, unknown>) => {
    dataQueue.push(data);
    if (ws.readyState === WebSocket.OPEN) {
      flushQueue();
    } else if (Buffer.isBuffer(data)) {
      logger.debug('>> Audio chunk queued.');
    }
  };

  const url = new URL(DEEPGRAM_WSS_URL);
  url.searchParams.set('model', 'nova-2-conversationalai');
  const ws = new WebSocket(url, undefined, {
    headers: {
      Authorization: `Token ${DEEPGRAM_KEY}`,
    },
  });

  const startTime = Date.now();
  ws.on('open', () => {
    const timeElapsed = Date.now() - startTime;
    logger.log(`Deepgram connection opened in ${timeElapsed}ms`);
    flushQueue();
  });

  ws.on('message', (rawMessage, _isBinary) => {
    const message = parseMessage(toString(rawMessage));
    switch (message.type) {
      case 'Results': {
        // Should look like: { "type": "Results", "channel_index": [0, 1], "duration": 0.061875343, "start": 7.74, "is_final": true, "speech_final": false, "channel": { "alternatives": [{ "transcript": "...", "confidence": 1, "words": [{ "word": "foo", "start": 1.72, "end": 1.96, "confidence": 0.9970703 }] }] }, "metadata": { "request_id": "...", "model_uuid": "...", "model_info": { ... } }, "from_finalize": false }
        const channel = Object(message.channel);
        const result = Object(toArray(channel.alternatives)[0]);
        const transcript = String(result.transcript ?? '');
        // I actually don't believe this is necessary, it comes already trimmed
        const text = transcript.trim();
        const hasStartedSpeaking = textFragments.length > 0;
        // TODO: Find a better way to detect pause?
        if (text === '' && hasStartedSpeaking) {
          onDone();
          ws.terminate();
          break;
        }
        logger.log({ text });
        if (text) {
          onText(text);
          textFragments.push(text);
        }
        break;
      }
      case 'Metadata': {
        // Should look like: { "type": "Metadata", "transaction_key": "deprecated", "request_id": "...", "sha256": "...", "created": "2024-07-30T20:31:13.685Z", "duration": 7.801875, "channels": 1, "models": [...], "model_info": { ... } }
        break;
      }
      default: {
        logger.warn('Unrecognized Deepgram message:', message);
      }
    }
  });

  ws.on('close', (code, reasonRaw) => {
    const reason = toString(reasonRaw);
    logger.log('Deepgram connection closed:', { code, reason });
    onDone();
  });

  ws.on('error', (error) => {
    logger.warn('Deepgram connection experienced an error:', error);
    // TODO: Clean up?
    onError(error);
  });

  return {
    send: (data: Buffer) => {
      send(data);
    },
    done: () => {
      send({ type: 'CloseStream' });
    },
    terminate: () => {
      ws.terminate();
    },
  };
}

function toString(input: Buffer | ArrayBuffer | Array<Buffer>) {
  if (Buffer.isBuffer(input)) {
    return input.toString('utf8');
  }
  if (Array.isArray(input)) {
    return Buffer.concat(input).toString('utf8');
  }
  return Buffer.from(input).toString('utf8');
}

function toArray(input: unknown): Array<unknown> {
  return Array.isArray(input) ? input : [];
}
