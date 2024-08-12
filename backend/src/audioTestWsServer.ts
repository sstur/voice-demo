import { createReadStream } from 'fs';
import { resolve } from 'path';

import { WebSocketServer } from 'ws';

import { logger } from './support/Logger';
import { parseMessage } from './support/parseMessage';

export const wss = new WebSocketServer({
  noServer: true,
  // This will terminate any upgrade request for any other pathname
  path: '/sockets/audio-test',
});

wss.on('connection', (socket) => {
  const send = (message: Record<string, unknown>) => {
    socket.send(JSON.stringify(message));
  };

  const streamAudioToSocket = async (readStream: AsyncIterable<Buffer>) => {
    for await (const chunk of readStream) {
      send({
        type: 'AUDIO_CHUNK',
        value: chunk.toString('base64'),
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
        const path = resolve(__dirname, '../../1723501987611.pcm');
        const readStream = createReadStream(path);
        void streamAudioToSocket(readStream);
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
