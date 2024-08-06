import type { ChatCompletionMessageParam as Message } from 'openai/resources';
import { WebSocketServer } from 'ws';

import { AgentController } from './AgentController';
import type { DeepgramConnection } from './support/DeepgramConnection';
import { DeepgramPool } from './support/DeepgramPool';
import { logger } from './support/Logger';
import { parseMessage } from './support/parseMessage';

type ConversationState =
  | { name: 'IDLE' }
  | { name: 'RECEIVING_AUDIO'; transcriber: DeepgramConnection }
  | { name: 'FINALIZING_TRANSCRIPTION' }
  | { name: 'AGENT_WORKING'; agentController: AgentController }
  | { name: 'AGENT_DONE' }
  | { name: 'CLOSED' }
  | { name: 'ERROR'; error: unknown };

type Ref<T> = { current: T };

const deepgramPool = new DeepgramPool();

export const wss = new WebSocketServer({
  noServer: true,
  // This will terminate any upgrade request for any other pathname
  path: '/sockets/chat',
});

wss.on('connection', (socket) => {
  const state: Ref<ConversationState> = { current: { name: 'IDLE' } };
  const conversation: Array<Message> = [];

  const send = (message: Record<string, unknown>) => {
    socket.send(JSON.stringify(message));
  };

  socket.on('message', (data, isBinary) => {
    // Not currently supporting binary messages
    if (isBinary) {
      logger.warn(`Unsupported: Received binary message from client`);
      return;
    }
    const payload = parseMessage(toString(data));
    switch (payload.type) {
      case 'START_UPLOAD_STREAM': {
        const transcriber = deepgramPool.get();
        readEntireStream(transcriber)
          .then((textFragments) => {
            // TODO: If result is empty, what should we do?
            const content = textFragments.join(' ');
            conversation.push({ role: 'user', content });
            // One potential flow is frontend sends AUDIO_DONE and we call
            // transcriber.done() which invokes this code path here.
            // Alternatively if Deepgram identifies a period of silence it will
            // invoke this code path and we need to tell the frontend to stop
            // the recording.
            send({ type: 'STOP_UPLOAD_STREAM' });
            logger.log('Transcription complete:', JSON.stringify(content));
            const agentController = new AgentController({
              conversation,
              onError: (error) => {
                // TODO: Cleanup?
                logger.error(error);
                state.current = { name: 'ERROR', error };
              },
              onFinalTextResponse: (content) => {
                conversation.push({ role: 'assistant', content });
              },
              onDone: () => {
                state.current = { name: 'AGENT_DONE' };
              },
            });
            state.current = { name: 'AGENT_WORKING', agentController };
            void agentController.start();
          })
          .catch((_error: unknown) => {
            // TODO
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
            const data = Buffer.from(value, 'base64');
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
        switch (currentState.name) {
          case 'FINALIZING_TRANSCRIPTION': {
            send({ type: 'START_PLAYBACK_RESULT', status: 'TRY_AGAIN' });
            break;
          }
          case 'AGENT_WORKING': {
            const { agentController } = currentState;
            const playbackUrl = agentController.getOutputUrl();
            send({
              type: 'START_PLAYBACK_RESULT',
              status: 'READY',
              playbackUrl,
            });
            break;
          }
          default: {
            const errorMsg = `Unable to start playback in state ${currentState.name}`;
            logger.warn(errorMsg);
            send({
              type: 'START_PLAYBACK_RESULT',
              status: 'ERROR',
              error: errorMsg,
            });
          }
        }
        break;
      }
    }
  });

  socket.on('error', (error) => {
    logger.log('Client connection error:', error);
    if (state.current.name === 'RECEIVING_AUDIO') {
      const { transcriber } = state.current;
      transcriber.terminate();
    }
  });

  socket.on('close', () => {
    logger.log('Client connection closed.');
    if (state.current.name === 'RECEIVING_AUDIO') {
      const { transcriber } = state.current;
      transcriber.terminate();
    }
  });

  send({ type: 'READY' });
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

async function readEntireStream<T>(readable: AsyncIterable<T>) {
  const results: Array<T> = [];
  for await (const chunk of readable) {
    results.push(chunk);
  }
  return results;
}
