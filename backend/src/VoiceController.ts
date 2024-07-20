import Cartesia from '@cartesia/cartesia-js';

import { CARTESIA_KEY } from './support/constants';

const cartesia = new Cartesia({
  apiKey: CARTESIA_KEY,
});

export class VoiceController {
  inputStream: AsyncIterator<string, undefined>;
  contextId: string;
  onChunk: (chunk: Buffer) => void;
  onError: (error: unknown) => void;
  onDone: () => void;

  constructor(init: {
    inputStream: AsyncIterator<string, undefined>;
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
    }

    let isStreaming = false;
    const beginStreaming = async (stream: AsyncIterableIterator<string>) => {
      if (!isStreaming) {
        isStreaming = true;
        for await (const message of stream) {
          const chunk = Buffer.from(message, 'base64');
          // TODO: Add await?
          onChunk(chunk);
        }
        onDone();
      }
    };

    const send = (text: string, isFinal: boolean) => {
      const response = websocket.send({
        model_id: 'sonic-english',
        voice: {
          mode: 'id',
          id: 'a0e99841-438c-4a64-b679-ae501e7d6091',
        },
        transcript: text,
        context_id: contextId,
        continue: !isFinal,
      });
      void beginStreaming(response.events('message'));
    };

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
    while (true) {
      const { value, done } = await inputStream.next();
      send(value ?? '', done ?? false);
    }
  }
}
