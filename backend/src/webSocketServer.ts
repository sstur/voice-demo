import { WebSocketServer } from 'ws';

import { AgentController } from './AgentController';
import { createTranscriber } from './deepgram';
import { createLogger } from './support/Logger';

type Transcriber = ReturnType<typeof createTranscriber>;

type ConversationState =
  | { name: 'IDLE' }
  | { name: 'RECEIVING_AUDIO'; transcriber: Transcriber }
  | { name: 'FINALIZING_TRANSCRIPTION' }
  | { name: 'AGENT_WORKING'; agentController: AgentController }
  | { name: 'AGENT_DONE' }
  | { name: 'CLOSED' }
  | { name: 'ERROR'; error: unknown };

type Ref<T> = { current: T };

export const wss = new WebSocketServer({
  noServer: true,
  // This will terminate any upgrade request for any other pathname
  path: '/sockets/chat',
});

wss.on('connection', (socket) => {
  const logger = createLogger({ level: 'INFO' });

  const state: Ref<ConversationState> = { current: { name: 'IDLE' } };

  const send = (message: Record<string, unknown>) => {
    socket.send(JSON.stringify(message));
  };

  socket.on('message', (data, isBinary) => {
    // Not currently supporting binary messages
    if (isBinary) {
      return;
    }
    const payload = parseMessage(toString(data));
    switch (payload.type) {
      case 'START_UPLOAD_STREAM': {
        const chunks: Array<string> = [];
        const transcriber = createTranscriber({
          logger,
          onText: (text, { isFinal }) => {
            if (isFinal) {
              chunks.push(text);
            }
          },
          onError: (_error) => {
            // TODO
          },
          onClose: ({ code }) => {
            const _isSuccess = code === 1000;
            const result = chunks.join('');
            logger.log({ transcriptionResult: result });
            const agentController = new AgentController({
              userInput: result,
              onError: (error) => {
                // TODO: log, cleanup?
                state.current = { name: 'ERROR', error };
              },
              onDone: () => {
                state.current = { name: 'AGENT_DONE' };
              },
            });
            state.current = { name: 'AGENT_WORKING', agentController };
            void agentController.start();
          },
        });
        state.current = { name: 'RECEIVING_AUDIO', transcriber };
        send({ type: 'START_UPLOAD_STREAM_RESULT', success: true });
        break;
      }
      case 'AUDIO_CHUNK': {
        if (state.current.name === 'RECEIVING_AUDIO') {
          const { transcriber } = state.current;
          const { value } = payload;
          if (typeof value === 'string') {
            const data = Buffer.from(value, 'utf8');
            transcriber.send(data);
          }
        }
        break;
      }
      case 'AUDIO_DONE': {
        if (state.current.name === 'RECEIVING_AUDIO') {
          const { transcriber } = state.current;
          state.current = { name: 'FINALIZING_TRANSCRIPTION' };
          transcriber.done();
        }
        break;
      }
      case 'START_PLAYBACK': {
        const currentState = state.current;
        if (currentState.name === 'AGENT_WORKING') {
          const { agentController } = currentState;
          const playbackUrl = agentController.getOutputUrl();
          send({ type: 'START_PLAYBACK_RESULT', success: true, playbackUrl });
        } else {
          const error = `Unable to start playback in state ${currentState.name}`;
          send({ type: 'START_PLAYBACK_RESULT', success: false, error });
        }
        break;
      }
    }
  });

  socket.on('error', (error) => {
    logger.log('>> Client connection error:', error);
    if (state.current.name === 'RECEIVING_AUDIO') {
      const { transcriber } = state.current;
      transcriber.terminate();
    }
  });

  socket.on('close', () => {
    logger.log('>> Client connection closed.');
    if (state.current.name === 'RECEIVING_AUDIO') {
      const { transcriber } = state.current;
      transcriber.terminate();
    }
  });
});

function toString(input: Buffer | ArrayBuffer | Array<Buffer>) {
  if (Buffer.isBuffer(input)) {
    return input;
  }
  if (Array.isArray(input)) {
    return Buffer.concat(input);
  }
}

function safeParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function isObject(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input);
}

function parseMessage(input: unknown): Record<string, unknown> {
  const result = typeof input === 'string' ? safeParse(input) : null;
  return isObject(result) ? result : {};
}
