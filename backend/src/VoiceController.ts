import Cartesia from '@cartesia/cartesia-js';

import { CARTESIA_KEY } from './support/constants';
import { parseMessage } from './support/parseMessage';

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
      for await (const rawMessage of stream) {
        const message = parseMessage(rawMessage);
        switch (message.type) {
          // An error message will look like: { "type": "error", "context_id": "...", "status_code": 500, "done": true, "error": "..." }
          case 'error': {
            const error = new Error(String(message.error));
            onError(error);
            this.state = { name: 'ERROR', error };
            break;
          }
          // A data chunk will look like: { "type": "chunk", "context_id": "...", "status_code": 206, "done": false, "data": "....", "step_time": 55.578796 }
          case 'chunk': {
            const chunk = Buffer.from(String(message.data), 'base64');
            // TODO: Add await?
            onChunk(chunk);
            break;
          }
          // A done message will look like: { "type": "done", "context_id": "...", "status_code": 200, "done": true }
          default: {
            //
          }
        }
        if (message.done) {
          break;
        } else {
          continue;
        }
      }
      // TODO: This will be called even if onError is called above. Is this the correct behavior?
      onDone();
    };

    const send = (text: string, isFinal = false) => {
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
