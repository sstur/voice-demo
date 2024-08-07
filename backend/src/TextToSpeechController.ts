import type { ChildProcessWithoutNullStreams } from 'child_process';
import { spawn } from 'child_process';

import type {
  WebSocket,
  WebSocketBaseResponse,
  WebSocketResponse as WebSocketResponseWithoutDone,
} from '@cartesia/cartesia-js';
import Cartesia from '@cartesia/cartesia-js';

import type { AsyncQueue } from './support/AsyncQueue';
import { CARTESIA_KEY } from './support/constants';
import { createId } from './support/createId';
import { eventLogger } from './support/EventLogger';
import { logger } from './support/Logger';
import { parseMessage } from './support/parseMessage';
import { voiceResponseStore } from './voiceResponseStore';

// Keep these in sync with the ffmpeg output settings below
export const OUTPUT_FORMAT_CONTENT_TYPE = 'audio/aac';
export const OUTPUT_FILE_NAME = 'audio.aac';

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
  contextId: string;
  outputQueue: AsyncQueue<Buffer>;
  hasStartedStreaming = false;
  onError: (error: unknown) => void;
  onDone: () => void;
  ffmpeg: ChildProcessWithoutNullStreams;
  websocket: WebSocket;
  hasSentText = false;

  constructor(init: { onError: (error: unknown) => void; onDone: () => void }) {
    const { onError, onDone } = init;
    const contextId = (this.contextId = createId());
    this.outputQueue = voiceResponseStore.create(contextId);
    this.onError = (error: unknown) => {
      this.outputQueue.close();
      onError(error);
    };
    this.onDone = onDone;

    const ffmpeg = spawn(
      'ffmpeg',
      [
        ['-f', 's16le'],
        ['-ar', '44100'],
        ['-ac', '1'],
        ['-i', '-'],
        ['-c:a', 'aac'],
        ['-f', 'adts'],
        '-',
      ].flat(),
    );

    this.ffmpeg = ffmpeg;

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      void this.outputQueue.write(chunk);
    });

    ffmpeg.stdout.on('error', (error) => {
      this.onError(error);
      this.state = { name: 'ERROR', error };
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        logger.warn(`FFmpeg process exited with code ${code}`);
      }
      onDone();
    });

    eventLogger.event('tts_init');
    this.websocket = cartesia.tts.websocket({
      container: 'raw',
      encoding: 'pcm_s16le',
      sampleRate: 44100,
    });
  }

  async start() {
    try {
      await this.websocket.connect();
    } catch (error) {
      this.onError(error);
      this.state = { name: 'ERROR', error };
      return;
    }
    eventLogger.event('tts_connected');
    setInterval(() => {
      const date = new Date();
      const minutes = date.getMinutes();
      const seconds = date.getSeconds();
      this.write(`${minutes} minutes and ${seconds} seconds. `);
    }, 5000);
  }

  private send(text: string, isFinal = false) {
    if (!this.hasSentText) {
      eventLogger.event('tts_first_text_sent');
      this.hasSentText = true;
    }
    logger.log('>> Sending to Cartesia:', JSON.stringify(text));
    return this.websocket.send({
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
        id: '11af83e2-23eb-452f-956e-7fee218ccb5c',
      },
      transcript: text,
      context_id: this.contextId,
      continue: !isFinal,
      add_timestamps: true,
    });
  }

  private async beginStreaming(stream: AsyncIterableIterator<string>) {
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
          this.onError(error);
          this.state = { name: 'ERROR', error };
          this.ffmpeg.kill();
          break;
        }
        // A data chunk will look like: { "status_code": 206, "done": false, "type": "chunk", "data": "....", "step_time": 55.578796, "context_id": "..." }
        case 'chunk': {
          if (!hasReceivedAudio) {
            eventLogger.event('tts_first_audio_received');
            hasReceivedAudio = true;
          }
          const chunk = Buffer.from(message.data, 'base64');
          this.ffmpeg.stdin.write(chunk);
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
      this.ffmpeg.stdin.end();
    }
  }

  write(text: string) {
    if (this.state.name === 'ERROR') {
      return;
    }
    const response = this.send(text);
    if (!this.hasStartedStreaming) {
      void this.beginStreaming(response.events('message'));
      this.hasStartedStreaming = true;
    }
  }

  getOutputUrl() {
    const { contextId } = this;
    return `/playback/${contextId}`;
  }
}
