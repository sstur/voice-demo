import Cartesia from '@cartesia/cartesia-js';

import { CARTESIA_KEY } from './support/constants';

const cartesia = new Cartesia({
  apiKey: CARTESIA_KEY,
});

export class VoiceController {
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
      container: 'wav',
      encoding: 'pcm_s16le',
      sampleRate: 44100,
    });

    try {
      await websocket.connect();
    } catch (error) {
      onError(error);
      return;
    }

    const beginStreaming = async (stream: AsyncIterableIterator<string>) => {
      for await (const message of stream) {
        const chunk = Buffer.from(message, 'base64');
        // TODO: Add await?
        onChunk(chunk);
      }
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
      const response = send(chunk);
      if (!hasStartedStreaming) {
        void beginStreaming(response.events('message'));
        hasStartedStreaming = true;
      }
    }
    send('', true);
  }
}
