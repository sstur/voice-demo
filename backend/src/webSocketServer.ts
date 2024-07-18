import type { LiveTranscriptionEvent } from '@deepgram/sdk';
import {
  createClient,
  LiveTranscriptionEvents,
  SOCKET_STATES,
} from '@deepgram/sdk';
import type { ICloseEvent } from 'websocket';
import { WebSocket, WebSocketServer } from 'ws';

import { DEEPGRAM_KEY } from './support/constants';
import { createLogger } from './support/Logger';

const deepgram = createClient(DEEPGRAM_KEY);

export const wss = new WebSocketServer({
  noServer: true,
  // This will terminate any upgrade request for any other pathname
  path: '/sockets/transcribe',
});

wss.on('connection', (socket) => {
  const logger = createLogger({ level: 'WARN' });

  const state = {
    isReceivingAudioData: true,
    isUpstreamInitialized: false,
  };

  const dataQueue: Array<Buffer | 'DONE'> = [];

  const flushQueue = () => {
    for (const message of dataQueue) {
      if (message === 'DONE') {
        dgConnection.finish();
        break;
      }
      dgConnection.send(message);
    }
    dataQueue.length = 0;
  };

  const send = (data: Buffer | 'DONE') => {
    dataQueue.push(data);
    if (
      state.isUpstreamInitialized &&
      dgConnection.getReadyState() === SOCKET_STATES.open
    ) {
      flushQueue();
    }
  };

  const dgConnection = deepgram.listen.live({
    interim_results: true,
    model: 'nova-2-conversationalai',
    keywords: ['Genie:5', 'Ariel:-15', 'Ario:80'],
    smart_format: true,
  });

  dgConnection.on('open', () => {
    logger.log('Deepgram open');
    state.isUpstreamInitialized = true;
    flushQueue();
  });

  dgConnection.on('close', (event: ICloseEvent) => {
    const { code, reason, wasClean } = event;
    logger.log('Deepgram closed', { code, reason, wasClean });
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    // This represents "normal closure"
    if (code === 1000) {
      socket.close(code);
      return;
    }
    // The upstream connection may have given us a potentially invalid status
    // code, for example: "1006: Socket Error" Our server library will not
    // allow any 1xxx code except those in the range(s): 1000-1003, 1007-1014
    // See: https://github.com/websockets/ws/blob/8.17.0/lib/validation.js#L35-L44
    // Here we're using status code 1011 which "indicates that a server is
    // terminating the connection because it encountered an unexpected
    // condition"
    // See: https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4
    socket.close(1011, `[Upstream] ${code}: ${reason}`);
  });

  dgConnection.on('error', (error) => {
    logger.warn('dgConnection received error:', error);
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.close(1011, `[Upstream error] ${String(error)}`);
  });

  dgConnection.on(
    LiveTranscriptionEvents.Transcript,
    (data: LiveTranscriptionEvent) => {
      const isFinal = data.is_final ?? false;
      for (const { transcript } of data.channel.alternatives) {
        if (typeof transcript === 'string') {
          const text = transcript.trim();
          socket.send(JSON.stringify({ type: 'RESULT', text, isFinal }));
        }
      }
    },
  );

  socket.on('message', (data, isBinary) => {
    const payload = parseIncomingData(toBuffer(data), isBinary);
    if (Buffer.isBuffer(payload)) {
      if (state.isReceivingAudioData) {
        send(payload);
      }
      return;
    }
    if (payload.type === 'DONE' && state.isReceivingAudioData) {
      state.isReceivingAudioData = false;
      send('DONE');
    }
  });

  socket.on('error', (_error) => {
    // TODO: Terminate Deepgram connection
  });

  socket.on('close', () => {
    logger.log('>> Client connection closed.');
    if (dgConnection.getReadyState() === SOCKET_STATES.open) {
      dgConnection.finish();
    }
  });
});

function parseIncomingData(payload: Buffer, isBinary: boolean) {
  if (isBinary) {
    return payload;
  }
  const stringPayload = payload.toString();
  // The string here should be either a JSON-encoded object or base64-encoded
  // binary data. We can determine which one by checking the first character
  // since a JSON object will start with a "{" and a base64-encoded string can
  // never start with that character (only [A-Za-z0-9+/=]).
  const isJson = stringPayload.charAt(0) === '{';
  if (isJson) {
    return parseMessage(stringPayload);
  }
  // Here we can assume the string payload is base-64 encoded binary data.
  // Since RN on Android cannot send a binary payload, we're using base64.
  return Buffer.from(stringPayload, 'base64');
}

function toBuffer(input: Buffer | ArrayBuffer | Array<Buffer>): Buffer {
  if (Buffer.isBuffer(input)) {
    return input;
  }
  if (Array.isArray(input)) {
    return Buffer.concat(input);
  }
  return Buffer.from(input);
}

function safeParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function isObject(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input);
}

function parseMessage(input: unknown): Record<string, unknown> {
  const result = typeof input === 'string' ? safeParse(input) : null;
  return isObject(result) ? result : {};
}
