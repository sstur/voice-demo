import { spawn } from 'child_process';

import Cartesia from '@cartesia/cartesia-js';

import { CARTESIA_KEY } from './support/constants';
import { parseMessage } from './support/parseMessage';

// Keep these in sync with the ffmpeg output settings below
export const OUTPUT_FORMAT_CONTENT_TYPE = 'audio/aac';
export const OUTPUT_FILE_NAME = 'audio.aac';

const cartesia = new Cartesia({
  apiKey: CARTESIA_KEY,
});

type State =
  | { name: 'NONE' }
  | { name: 'RUNNING' }
  | { name: 'ERROR'; error: unknown };

export class VoiceController {
  state: State = { name: 'NONE' };
  inputStream: AsyncIterableIterator<string>;
  contextId: string;
  onAudioChunk: (chunk: Buffer) => void;
  onError: (error: unknown) => void;
  onFinalTextResponse: (content: string) => void;
  onDone: () => void;

  constructor(init: {
    inputStream: AsyncIterableIterator<string>;
    contextId: string;
    onAudioChunk: (chunk: Buffer) => void;
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

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      onAudioChunk(chunk);
    });

    ffmpeg.stdout.on('error', (error) => {
      onError(error);
      this.state = { name: 'ERROR', error };
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        // eslint-disable-next-line no-console
        console.warn(`FFmpeg process exited with code ${code}`);
      }
      onDone();
    });

    const startTime = Date.now();
    const websocket = cartesia.tts.websocket({
      container: 'raw',
      encoding: 'pcm_s16le',
      sampleRate: 44100,
    });

    try {
      await websocket.connect();
    } catch (error) {
      onError(error);
      this.state = { name: 'ERROR', error };
      return;
    }

    const beginStreaming = async (stream: AsyncIterableIterator<string>) => {
      let hasStarted = false;
      for await (const rawMessage of stream) {
        if (this.state.name === 'ERROR') {
          break;
        }
        const message = parseMessage(rawMessage);
        switch (message.type) {
          // An error message will look like: { "type": "error", "context_id": "...", "status_code": 500, "done": true, "error": "..." }
          case 'error': {
            const error = new Error(String(message.error));
            onError(error);
            this.state = { name: 'ERROR', error };
            ffmpeg.kill();
            break;
          }
          // A data chunk will look like: { "type": "chunk", "context_id": "...", "status_code": 206, "done": false, "data": "....", "step_time": 55.578796 }
          case 'chunk': {
            if (!hasStarted) {
              const timeElapsed = Date.now() - startTime;
              console.log('>> Time to first audio chunk:', timeElapsed);
              hasStarted = true;
            }
            const chunk = Buffer.from(String(message.data), 'base64');
            ffmpeg.stdin.write(chunk);
            break;
          }
          // A done message will look like: { "type": "done", "context_id": "...", "status_code": 200, "done": true }
          case 'done': {
            break;
          }
          default: {
            // eslint-disable-next-line no-console
            console.warn('Unhandled message received from Cartesia:', message);
          }
        }
        if (message.done) {
          break;
        } else {
          continue;
        }
      }
      if (this.state.name !== 'ERROR') {
        ffmpeg.stdin.end();
      }
    };

    const send = (text: string, isFinal = false) => {
      console.log('Sending to Cartesia:', JSON.stringify(text));
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
          id: '11af83e2-23eb-452f-956e-7fee218ccb5c',
        },
        transcript: text,
        context_id: contextId,
        continue: !isFinal,
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
    this.onFinalTextResponse(allTokens.join(''));
  }
}
