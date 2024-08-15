import type {
  WebSocket,
  WebSocketBaseResponse,
  WebSocketResponse as WebSocketResponseWithoutDone,
} from '@cartesia/cartesia-js';
import Cartesia from '@cartesia/cartesia-js';

import { CARTESIA_KEY } from './support/constants';
import { createId } from './support/createId';
import { eventLogger } from './support/EventLogger';
import { logger } from './support/Logger';
import { parseMessage } from './support/parseMessage';
import { voiceId } from './voice';

// This should be a multiple of 4 since the samples are float32.
// If too small this will cause stutter in playback; I'm not totally sure
// why, but it's possibly related to the overhead of decoding and processing
// WebSocket messages.
const CHUNK_SIZE = 48 * 1024;

// Not sure why the done response is not included in the types provided
type WebSocketDoneResponse = WebSocketBaseResponse & { type: 'done' };
type WebSocketResponse = WebSocketResponseWithoutDone | WebSocketDoneResponse;

const cartesia = new Cartesia({
  apiKey: CARTESIA_KEY,
});

type State =
  | { name: 'IDLE' }
  | { name: 'RUNNING'; websocket: WebSocket }
  | { name: 'ERROR'; error: unknown }
  | { name: 'CLOSED' };

type Caption = {
  text: string;
  startTime: number;
  endTime: number;
};

export type AudioMetaData = {
  captions: Array<Caption>;
};

export class TextToSpeechController {
  state: State = { name: 'IDLE' };
  private inputStream: AsyncIterableIterator<string>;
  private contextId: string;
  private onAudioChunk: (chunk: string) => void;
  private onAudioMeta: (meta: AudioMetaData) => void;
  private onError: (error: unknown) => void;
  private onFinalTextResponse: (content: string) => void;
  private onDone: () => void;
  private voiceId: string | undefined;

  constructor(init: {
    inputStream: AsyncIterableIterator<string>;
    onAudioChunk: (chunk: string) => void;
    onAudioMeta: (meta: AudioMetaData) => void;
    onError: (error: unknown) => void;
    onFinalTextResponse: (content: string) => void;
    onDone: () => void;
    voiceId: string | undefined;
  }) {
    const {
      inputStream,
      onAudioChunk,
      onAudioMeta,
      onError,
      onFinalTextResponse,
      onDone,
      voiceId,
    } = init;
    this.inputStream = inputStream;
    this.contextId = createId();
    this.onAudioChunk = onAudioChunk;
    this.onAudioMeta = onAudioMeta;
    this.onError = onError;
    this.onFinalTextResponse = onFinalTextResponse;
    this.onDone = onDone;
    this.voiceId = voiceId;
  }

  async start() {
    const { inputStream, contextId, onAudioChunk, onError, onDone } = this;

    eventLogger.event('tts_init');
    const websocket = cartesia.tts.websocket({
      container: 'raw',
      encoding: 'pcm_f32le',
      sampleRate: 16000,
    });

    this.state = { name: 'RUNNING', websocket };

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
      let buffer = Buffer.from('');
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
            const chunk = Buffer.from(message.data, 'base64');
            buffer = Buffer.concat([buffer, chunk]);
            while (buffer.length >= CHUNK_SIZE) {
              const chunkToSend = buffer.subarray(0, CHUNK_SIZE);
              buffer = buffer.subarray(CHUNK_SIZE);
              onAudioChunk(chunkToSend.toString('base64'));
            }
            break;
          }
          // A timestamps message will look like: { "status_code": 206, "done": false, "type": "timestamps", "word_timestamps": { "words": ["Hello"], "start": [0.0], "end": [1.0] }, "context_id": "..." }
          case 'timestamps': {
            const captions: Array<Caption> = [];
            const { words, start, end } = message.word_timestamps;
            const text = words.join(' ');
            const startTime = toMs(start[0] ?? 0);
            const endTime = toMs(end.at(-1) ?? 0);
            captions.push({ text, startTime, endTime });
            this.onAudioMeta({ captions });
            break;
          }
          // A done message will look like: { "status_code": 200, "done": true, "type": "done", "context_id": "..." }
          case 'done': {
            if (buffer.length) {
              onAudioChunk(buffer.toString('base64'));
            }
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
        this.state = { name: 'CLOSED' };
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
          id: this.voiceId ?? voiceId,
        },
        transcript: text,
        context_id: contextId,
        continue: !isFinal,
        add_timestamps: true,
      });
    };

    let hasStartedStreaming = false;
    const allTokens: Array<string> = [];
    let textReceived = '';
    for await (const token of inputStream) {
      if (String(this.state.name) !== 'RUNNING') {
        break;
      }
      textReceived += token;
      allTokens.push(token);
      // Accumulate a tokens into sentences before sending.
      const sentences = textReceived.split(/[\r\n]+/);
      while (sentences.length > 1) {
        const sentence = sentences.shift();
        if (sentence) {
          const response = send(sentence + ' ');
          if (!hasStartedStreaming) {
            void beginStreaming(response.events('message'));
            hasStartedStreaming = true;
          }
        }
      }
      textReceived = sentences.join('\n');
    }
    const response = send(textReceived, true);
    if (!hasStartedStreaming) {
      void beginStreaming(response.events('message'));
      hasStartedStreaming = true;
    }
    eventLogger.event('tts_all_text_sent');
    this.onFinalTextResponse(allTokens.join(''));
  }

  terminate() {
    const { state } = this;
    if (state.name === 'RUNNING') {
      const { websocket } = state;
      websocket.disconnect();
      this.state = { name: 'CLOSED' };
    }
  }
}

function toMs(seconds: number) {
  return Math.round(seconds * 1000);
}
