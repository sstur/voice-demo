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
  onChunk: (chunk: Buffer) => void;
  onError: (error: unknown) => void;
  onDone: () => void;

  constructor(init: {
    inputStream: AsyncIterableIterator<string>;
    contextId: string;
    onChunk: (chunk: Buffer) => void;
    onError: (error: unknown) => void;
    onDone: () => void;
  }) {
    const { inputStream, contextId, onChunk, onError, onDone } = init;
    this.inputStream = inputStream;
    this.contextId = contextId;
    this.onChunk = onChunk;
    this.onError = onError;
    this.onDone = onDone;
  }

  async start() {
    const { inputStream, contextId, onChunk, onError, onDone } = this;

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
      onChunk(chunk);
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
          id: 'a0e99841-438c-4a64-b679-ae501e7d6091',
        },
        transcript: text,
        context_id: contextId,
        continue: !isFinal,
      });
    };

    let hasStartedStreaming = false;
    for await (const chunk of inputStream) {
      if (this.state.name === 'ERROR') {
        break;
      }
      const response = send(chunk);
      if (!hasStartedStreaming) {
        void beginStreaming(response.events('message'));
        hasStartedStreaming = true;
      }
    }
    send('', true);
  }
}
