import { WebSocketServer } from 'ws';

import { DeepgramConnection } from './support/DeepgramConnection';
import { logger } from './support/Logger';
import { parseMessage } from './support/parseMessage';
import { TextToSpeechController } from './TextToSpeechController';

type ConversationState =
  | { name: 'IDLE' }
  | {
      name: 'RUNNING';
      transcriber: DeepgramConnection;
      textToSpeechController: TextToSpeechController;
    }
  | { name: 'CLOSED' }
  | { name: 'ERROR'; error: unknown };

type Ref<T> = { current: T };

export const wss = new WebSocketServer({
  noServer: true,
  // This will terminate any upgrade request for any other pathname
  path: '/sockets/chat',
});

wss.on('connection', (socket) => {
  const state: Ref<ConversationState> = { current: { name: 'IDLE' } };

  const send = (message: Record<string, unknown>) => {
    socket.send(JSON.stringify(message));
  };

  const onError = (error: unknown) => {
    logger.error(error);
    state.current = { name: 'ERROR', error };
  };

  socket.on('message', (data, isBinary) => {
    // Not currently supporting binary messages
    if (isBinary) {
      logger.warn(`Unsupported: Received binary message from client`);
      return;
    }
    const payload = parseMessage(toString(data));
    switch (payload.type) {
      case 'INIT': {
        const transcriber = new DeepgramConnection({
          onText: (text) => {
            logger.log('>> Text:', JSON.stringify(text));
            // textToSpeechController.write(text);
          },
          onError: (error) => onError(error),
          onDone: () => {
            // TODO
          },
        });
        const textToSpeechController = new TextToSpeechController({
          onError: (error) => onError(error),
          onDone: () => {
            // TODO
          },
        });
        void Promise.all([
          transcriber.start(),
          textToSpeechController.start(),
        ]).then(() => {
          state.current = {
            name: 'RUNNING',
            transcriber,
            textToSpeechController,
          };
          const playbackUrl = textToSpeechController.getOutputUrl();
          send({ type: 'READY', playbackUrl });
        });
        break;
      }
      case 'AUDIO_CHUNK': {
        if (state.current.name === 'RUNNING') {
          const { transcriber } = state.current;
          const { value } = payload;
          if (typeof value === 'string') {
            const data = Buffer.from(value, 'base64');
            transcriber.send(data);
          }
        }
        break;
      }
      case 'AUDIO_DONE': {
        if (state.current.name === 'RUNNING') {
          const { transcriber } = state.current;
          state.current = { name: 'CLOSED' };
          transcriber.done();
        }
        break;
      }
      default: {
        logger.warn('Unrecognized message from client:', payload);
      }
    }
  });

  socket.on('error', (error) => {
    logger.log('Client connection error:', error);
    if (state.current.name === 'RUNNING') {
      const { transcriber } = state.current;
      transcriber.terminate();
    }
  });

  socket.on('close', () => {
    logger.log('Client connection closed.');
    if (state.current.name === 'RUNNING') {
      const { transcriber } = state.current;
      transcriber.terminate();
    }
  });
});

function toString(input: Buffer | ArrayBuffer | Array<Buffer>) {
  if (Buffer.isBuffer(input)) {
    return input.toString('utf8');
  }
  if (Array.isArray(input)) {
    return Buffer.concat(input).toString('utf8');
  }
  return Buffer.from(input).toString('utf8');
}
