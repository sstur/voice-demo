import type {
  ChatCompletionContentPartImage,
  ChatCompletionMessageParam as Message,
} from 'openai/resources';
import { WebSocketServer } from 'ws';

import { AgentController } from './AgentController';
import type { DeepgramConnection } from './support/DeepgramConnection';
import { DeepgramPool } from './support/DeepgramPool';
import { eventLogger } from './support/EventLogger';
import { logger } from './support/Logger';
import { parseMessage } from './support/parseMessage';

type ConversationState =
  | { name: 'IDLE' }
  | { name: 'RECEIVING_AUDIO'; transcriber: DeepgramConnection }
  | {
      name: 'FINALIZING_TRANSCRIPTION';
      whenDone: 'START_STREAMING' | 'STANDBY' | 'ABORT';
    }
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
  const images: Array<string> = [];

  const send = (message: Record<string, unknown>) => {
    socket.send(JSON.stringify(message));
  };

  const streamAudioToSocket = async (readStream: AsyncIterable<string>) => {
    for await (const chunk of readStream) {
      send({ type: 'AUDIO_CHUNK', value: chunk, done: false });
    }
    send({ type: 'AUDIO_CHUNK', done: true });
  };

  socket.on('message', (data, isBinary) => {
    // Not currently supporting binary messages
    if (isBinary) {
      logger.warn(`Unsupported: Received binary message from client`);
      return;
    }
    const payload = parseMessage(toString(data));
    switch (payload.type) {
      case 'LOG_RECORDING_STARTED': {
        eventLogger.event('client_recording_started');
        break;
      }
      case 'PHOTO': {
        images.push(String(payload.dataUri));
        break;
      }
      case 'START_UPLOAD_STREAM': {
        const transcriber = deepgramPool.get();
        readEntireStream(transcriber)
          .then((textFragments) => {
            if (state.current.name === 'CLOSED') {
              return;
            }
            const text = textFragments.join(' ');
            conversation.push({
              role: 'user',
              content: [
                ...images.map<ChatCompletionContentPartImage>((url) => ({
                  type: 'image_url',
                  image_url: { url, detail: 'low' },
                })),
                { type: 'text', text },
              ],
            });
            images.length = 0;
            // One potential flow is frontend sends AUDIO_DONE and we call
            // transcriber.done() which invokes this code path here.
            // Alternatively if Deepgram identifies a period of silence it will
            // invoke this code path.
            send({ type: 'TRANSCRIPTION_COMPLETE', transcription: text });
            logger.log('Transcription complete:', JSON.stringify(text));
            const agentController = new AgentController({
              conversation,
              // TODO: Remove this hack.
              voiceId: text.match(/british (voice|tone)/i)
                ? '79a125e8-cd45-4c13-8a67-188112f4dd22'
                : undefined,
              onAudioMeta: ({ captions }) => {
                send({ type: 'AUDIO_CAPTION', captions });
              },
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
                eventLogger.event('agent_done');
                eventLogger.dumpEventsRelative();
              },
            });
            const prevState = state.current;
            state.current = { name: 'AGENT_WORKING', agentController };
            void agentController.start();
            if (
              prevState.name === 'FINALIZING_TRANSCRIPTION' &&
              prevState.whenDone === 'START_STREAMING'
            ) {
              void streamAudioToSocket(agentController.outputQueue);
            }
          })
          .catch((error: unknown) => {
            state.current = { name: 'ERROR', error };
            // TODO: Cleanup
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
          state.current = {
            name: 'FINALIZING_TRANSCRIPTION',
            whenDone: 'STANDBY',
          };
          transcriber.done();
        }
        break;
      }
      case 'START_PLAYBACK': {
        const currentState = state.current;
        switch (currentState.name) {
          case 'FINALIZING_TRANSCRIPTION': {
            state.current = {
              name: 'FINALIZING_TRANSCRIPTION',
              whenDone: 'START_STREAMING',
            };
            break;
          }
          case 'AGENT_WORKING': {
            const { agentController } = currentState;
            void streamAudioToSocket(agentController.outputQueue);
            break;
          }
          default: {
            const errorMsg = `Unable to start playback in state ${currentState.name}`;
            logger.warn(errorMsg);
            // TODO: Send error
          }
        }
        break;
      }
      case 'ABORT_PLAYBACK': {
        const currentState = state.current;
        switch (currentState.name) {
          case 'FINALIZING_TRANSCRIPTION': {
            state.current = {
              name: 'FINALIZING_TRANSCRIPTION',
              whenDone: 'ABORT',
            };
            break;
          }
          case 'AGENT_WORKING': {
            const { agentController } = currentState;
            agentController.terminate();
            break;
          }
        }
        break;
      }
      case 'PARTIAL_PLAYBACK': {
        const contentPlayed = String(payload.contentPlayed);
        const lastMessage = conversation.at(-1);
        if (lastMessage?.role === 'assistant' && contentPlayed) {
          conversation.pop();
          conversation.push({ role: 'assistant', content: contentPlayed });
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
    const currentState = state.current;
    switch (currentState.name) {
      case 'RECEIVING_AUDIO': {
        const { transcriber } = currentState;
        transcriber.terminate();
        break;
      }
      case 'FINALIZING_TRANSCRIPTION': {
        state.current = { name: 'FINALIZING_TRANSCRIPTION', whenDone: 'ABORT' };
        break;
      }
      case 'AGENT_WORKING': {
        const { agentController } = currentState;
        agentController.terminate();
        break;
      }
    }
    state.current = { name: 'ERROR', error };
  });

  socket.on('close', () => {
    logger.log('Client connection closed.');
    const currentState = state.current;
    switch (currentState.name) {
      case 'RECEIVING_AUDIO': {
        const { transcriber } = currentState;
        transcriber.terminate();
        break;
      }
      case 'FINALIZING_TRANSCRIPTION': {
        state.current = { name: 'FINALIZING_TRANSCRIPTION', whenDone: 'ABORT' };
        break;
      }
      case 'AGENT_WORKING': {
        const { agentController } = currentState;
        agentController.terminate();
        break;
      }
    }
    state.current = { name: 'CLOSED' };
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
