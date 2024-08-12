import { WebSocketServer } from 'ws';

import { logger } from './support/Logger';
import { parseMessage } from './support/parseMessage';

export const wss = new WebSocketServer({
  noServer: true,
  // This will terminate any upgrade request for any other pathname
  path: '/sockets/audio-test',
});

const sampleText = `Once upon a time, in a lush, green forest, there lived a little dinosaur named Daisy. Daisy was a Triceratops with a big frill and three pointy horns, but she wasn't very big yet. She loved exploring the forest, but what she loved most of all was picking colorful flowers. Daisy's favorite spot was a bright meadow filled with all sorts of flowers, from tall sunflowers to tiny daisies just like her name!

One sunny day, Daisy decided to pick a special bouquet for her friend, Terry the Pterodactyl, who lived high up in the cliffs. She carefully gathered the prettiest flowers she could find, humming a happy tune as she went. But as she was about to head to Terry's nest, Daisy heard a rustling in the bushes. Out popped a little Velociraptor named Ricky, who looked very sad.

Ricky had lost his way home and was scared to go through the dark part of the forest alone. Daisy smiled and said, "Don't worry, Ricky! I'll walk with you." With Daisy leading the way, they traveled through the forest together, laughing and talking. Daisy's bright bouquet lit up the path, and soon enough, they found Ricky's family. Ricky was so grateful, and he even gave Daisy a pretty purple flower as a thank you. Daisy then flew up to Terry’s nest, where they all enjoyed the flowers together, happy to have such good friends.`;

wss.on('connection', (socket) => {
  const send = (message: Record<string, unknown>) => {
    socket.send(JSON.stringify(message));
  };

  const streamAudioToSocket = async (transcript: string) => {
    const url = new URL('https://api.cartesia.ai/tts/bytes');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Cartesia-Version': '2024-06-10',
        'X-API-Key': '5cb40c63-5c49-4ca8-8062-5e8e2e810e44',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
        model_id: 'sonic-english',
        voice: { mode: 'id', id: '11af83e2-23eb-452f-956e-7fee218ccb5c' },
        output_format: {
          container: 'raw',
          encoding: 'pcm_f32le',
          sample_rate: 16000,
        },
      }),
    });
    // Send in chunks this size.
    const CHUNK_SIZE = 48 * 1024;
    let buffer = Buffer.from('');
    if (response.body) {
      for await (const maybeChunk of response.body) {
        if (!(maybeChunk instanceof Uint8Array)) {
          console.error('Unexpected chunk of type:', typeof maybeChunk);
          break;
        }
        const chunk = Buffer.from(maybeChunk);
        buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
        if (buffer.length >= CHUNK_SIZE) {
          const sendChunk = buffer.subarray(0, CHUNK_SIZE);
          console.log('Chunk of size:', sendChunk.length);
          send({
            type: 'AUDIO_CHUNK',
            value: sendChunk.toString('base64'),
            done: false,
          });
          buffer = buffer.subarray(CHUNK_SIZE);
        }
      }
    }
    if (buffer.length) {
      send({
        type: 'AUDIO_CHUNK',
        value: buffer.toString('base64'),
        done: false,
      });
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
      case 'START_PLAYBACK': {
        void streamAudioToSocket(sampleText);
        break;
      }
      default: {
        logger.warn('Unrecognized message from client:', payload);
      }
    }
  });

  socket.on('error', (error) => {
    logger.log('Client connection error:', error);
  });

  socket.on('close', () => {
    logger.log('Client connection closed.');
  });
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
