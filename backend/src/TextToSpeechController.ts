import type {
  WebSocketBaseResponse,
  WebSocketResponse as WebSocketResponseWithoutDone,
} from '@cartesia/cartesia-js';
import Cartesia from '@cartesia/cartesia-js';

import { CARTESIA_KEY } from './support/constants';
import { eventLogger } from './support/EventLogger';
import { logger } from './support/Logger';
import { parseMessage } from './support/parseMessage';

// Not sure why the done response is not included in the types provided
type WebSocketDoneResponse = WebSocketBaseResponse & { type: 'done' };
type WebSocketResponse = WebSocketResponseWithoutDone | WebSocketDoneResponse;

const cartesia = new Cartesia({
  apiKey: CARTESIA_KEY,
});

type State =
  | { name: 'NONE' }
  | { name: 'RUNNING' }
  | { name: 'ERROR'; error: unknown };

export class TextToSpeechController {
  state: State = { name: 'NONE' };
  inputStream: AsyncIterableIterator<string>;
  contextId: string;
  onAudioChunk: (chunk: string) => void;
  onError: (error: unknown) => void;
  onFinalTextResponse: (content: string) => void;
  onDone: () => void;

  constructor(init: {
    inputStream: AsyncIterableIterator<string>;
    contextId: string;
    onAudioChunk: (chunk: string) => void;
    onError: (error: unknown) => void;
    onFinalTextResponse: (content: string) => void;
    onDone: () => void;
  }) {
    const {
      inputStream,
      contextId,
      onAudioChunk,
      onError,
      onFinalTextResponse,
      onDone,
    } = init;
    this.inputStream = inputStream;
    this.contextId = contextId;
    this.onAudioChunk = onAudioChunk;
    this.onError = onError;
    this.onFinalTextResponse = onFinalTextResponse;
    this.onDone = onDone;
  }

  async start() {
    const { inputStream, contextId, onAudioChunk, onError, onDone } = this;

    eventLogger.event('tts_init');
    const websocket = cartesia.tts.websocket({
      container: 'raw',
      encoding: 'pcm_f32le',
      sampleRate: 16000,
    });

    try {
      await websocket.connect();
    } catch (error) {
      onError(error);
      this.state = { name: 'ERROR', error };
      return;
    }

    eventLogger.event('tts_connected');

    const beginStreaming = async (stream: AsyncIterableIterator<string>) => {
      let hasReceivedAudio = false;
      for await (const rawMessage of stream) {
        if (this.state.name === 'ERROR') {
          break;
        }
        // For message types, see: https://docs.cartesia.ai/api-reference/endpoints/stream-speech-websocket
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const message = parseMessage(rawMessage) as WebSocketResponse;
        switch (message.type) {
          // An error message will look like: { "status_code": 500, "done": true, "type": "error", "error": "...", "context_id": "..." }
          case 'error': {
            const error = new Error(message.error);
            onError(error);
            this.state = { name: 'ERROR', error };
            onDone();
            break;
          }
          // A data chunk will look like: { "status_code": 206, "done": false, "type": "chunk", "data": "....", "step_time": 55.578796, "context_id": "..." }
          case 'chunk': {
            if (!hasReceivedAudio) {
              eventLogger.event('tts_first_audio_received');
              hasReceivedAudio = true;
            }
            onAudioChunk(message.data);
            break;
          }
          // A timestamps message will look like: { "status_code": 206, "done": false, "type": "timestamps", "word_timestamps": { "words": ["Hello"], "start": [0.0], "end": [1.0] }, "context_id": "..." }
          case 'timestamps': {
            const words = message.word_timestamps.words.join(' ');
            logger.log('>> Playing:', JSON.stringify(words));
            break;
          }
          // A done message will look like: { "status_code": 200, "done": true, "type": "done", "context_id": "..." }
          case 'done': {
            break;
          }
          default: {
            logger.warn('Unexpected message received from Cartesia:', message);
          }
        }
        if (message.done) {
          break;
        } else {
          continue;
        }
      }
      if (this.state.name !== 'ERROR') {
        onDone();
      }
    };

    let hasSentText = false;
    const send = (text: string, isFinal = false) => {
      if (!hasSentText) {
        eventLogger.event('tts_first_text_sent');
        hasSentText = true;
      }
      logger.log('>> Sending to Cartesia:', JSON.stringify(text));
      return websocket.send({
        model_id: 'sonic-english',
        voice: {
          mode: 'id',
          // id: '5345cf08-6f37-424d-a5d9-8ae1101b9377', // Maria
          // id: '11af83e2-23eb-452f-956e-7fee218ccb5c', // Midwestern Woman
          // id: 'c45bc5ec-dc68-4feb-8829-6e6b2748095d', // Movie man
          // id: '79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e', // Nonfiction Man
          // id: '15a9cd88-84b0-4a8b-95f2-5d583b54c72e', // Reading Lady
          // id: 'f9836c6e-a0bd-460e-9d3c-f7299fa60f94', // Southern Woman
          // id: '573e3144-a684-4e72-ac2b-9b2063a50b53', // Teacher Lady
          // id: '41534e16-2966-4c6b-9670-111411def906', // 1920's Radio man
          // id: 'b7d50908-b17c-442d-ad8d-810c63997ed9', // California Girl
          // id: 'c2ac25f9-ecc4-4f56-9095-651354df60c0', // Commercial Lady
          // id: '5c42302c-194b-4d0c-ba1a-8cb485c84ab9', // Female Nurse
          // id: '156fb8d2-335b-4950-9cb3-a2d33befec77', // Helpful Woman
          // id: '18bbf178-4921-45cf-b9e1-81f05a4588f2', // Pi clone
          id: '11af83e2-23eb-452f-956e-7fee218ccb5c',
        },
        transcript: text,
        context_id: contextId,
        continue: !isFinal,
        add_timestamps: true,
      });
    };

    let hasStartedStreaming = false;
    const tokens: Array<string> = [];
    const allTokens: Array<string> = [];
    for await (const token of inputStream) {
      if (this.state.name === 'ERROR') {
        break;
      }
      tokens.push(token);
      allTokens.push(token);
      // Accumulate a few tokens before sending.
      if (tokens.length > 4) {
        const joined = tokens.join('');
        tokens.length = 0;
        const text = joined.replace(
          /(\s*)(\S+)$/,
          (_, space: string, token: string) => {
            tokens.push(token);
            return space;
          },
        );
        if (text) {
          const response = send(text);
          if (!hasStartedStreaming) {
            void beginStreaming(response.events('message'));
            hasStartedStreaming = true;
          }
        }
      }
    }
    send(tokens.join(''), true);
    eventLogger.event('tts_all_text_sent');
    this.onFinalTextResponse(allTokens.join(''));
  }
}
