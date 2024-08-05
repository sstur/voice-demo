import { WebSocket } from 'ws';

import { DEEPGRAM_KEY, DEEPGRAM_WSS_URL } from './constants';
import { logger } from './Logger';
import { parseMessage } from './parseMessage';

const DEFAULT_POOL_SIZE = 2;
const KEEPALIVE_INTERVAL_MS = 2000;

type State =
  | { name: 'INITIALIZING'; queue: Array<Buffer | Record<string, unknown>> }
  | { name: 'READY'; keepaliveTimer: IntervalId }
  | { name: 'ERROR'; error: unknown }
  | { name: 'CLOSED' };

class DeepgramConnection {
  private textFragments: Array<string> = [];
  private state: State;
  private onText: (text: string) => void;
  private onError: (error: Error) => void;
  private onDone: () => void;
  private ws: WebSocket;

  constructor(init: {
    onText: (text: string) => void;
    onError: (error: Error) => void;
    onDone: () => void;
  }) {
    const { onText, onError, onDone } = init;

    this.state = { name: 'INITIALIZING', queue: [] };
    this.onText = onText;
    this.onError = onError;
    this.onDone = onDone;

    const url = new URL(DEEPGRAM_WSS_URL);
    url.searchParams.set('model', 'nova-2-conversationalai');
    const ws = new WebSocket(url, undefined, {
      headers: {
        Authorization: `Token ${DEEPGRAM_KEY}`,
      },
    });

    const startTime = Date.now();
    ws.on('open', () => {
      const { state } = this;
      if (state.name !== 'INITIALIZING') {
        return;
      }
      const timeElapsed = Date.now() - startTime;
      logger.log(`Deepgram connection opened in ${timeElapsed}ms`);
      for (const message of state.queue) {
        this.sendImmediate(message);
      }
      const keepaliveTimer = setInterval(
        () => this.sendImmediate({ type: 'KeepAlive' }),
        KEEPALIVE_INTERVAL_MS,
      );
      this.state = { name: 'READY', keepaliveTimer };
    });

    ws.on('message', (rawMessage, _isBinary) => {
      const message = parseMessage(toString(rawMessage));
      this.onMessage(message);
    });

    ws.on('close', (code, reasonRaw) => {
      const { state } = this;
      const reason = toString(reasonRaw);
      logger.log('Deepgram connection closed:', { code, reason });
      this.cleanup();
      if (state.name !== 'ERROR' && state.name !== 'CLOSED') {
        this.state = { name: 'CLOSED' };
        this.onDone();
      }
    });

    ws.on('error', (error) => {
      logger.warn('Deepgram connection experienced an error:', error);
      this.cleanup();
      onError(error);
      this.state = { name: 'ERROR', error };
    });

    this.ws = ws;
  }

  private sendImmediate(data: Buffer | Record<string, unknown>) {
    const { state } = this;
    if (state.name !== 'READY') {
      logger.warn(
        `>> Attempted send while DeepgramConnection in state ${state.name}`,
      );
      return;
    }
    if (Buffer.isBuffer(data)) {
      this.ws.send(data);
    } else {
      this.ws.send(JSON.stringify(data));
    }
  }

  private sendOrQueue(data: Buffer | Record<string, unknown>) {
    const { state } = this;
    if (state.name === 'INITIALIZING') {
      state.queue.push(data);
      return;
    }
    this.sendImmediate(data);
  }

  private onMessage(message: Record<string, unknown>) {
    const { textFragments } = this;
    switch (message.type) {
      case 'Results': {
        // Should look like: { "type": "Results", "channel_index": [0, 1], "duration": 0.061875343, "start": 7.74, "is_final": true, "speech_final": false, "channel": { "alternatives": [{ "transcript": "...", "confidence": 1, "words": [{ "word": "foo", "start": 1.72, "end": 1.96, "confidence": 0.9970703 }] }] }, "metadata": { "request_id": "...", "model_uuid": "...", "model_info": { ... } }, "from_finalize": false }
        const channel = Object(message.channel);
        const result = Object(toArray(channel.alternatives)[0]);
        const transcript = String(result.transcript ?? '');
        // I actually don't believe this is necessary, it comes already trimmed
        const text = transcript.trim();
        const hasStartedSpeaking = textFragments.length > 0;
        // TODO: Find a better way to detect pause?
        if (text === '' && hasStartedSpeaking) {
          this.terminate();
          break;
        }
        logger.log({ text });
        if (text) {
          this.onText(text);
          textFragments.push(text);
        }
        break;
      }
      case 'Metadata': {
        // Should look like: { "type": "Metadata", "transaction_key": "deprecated", "request_id": "...", "sha256": "...", "created": "2024-07-30T20:31:13.685Z", "duration": 7.801875, "channels": 1, "models": [...], "model_info": { ... } }
        break;
      }
      default: {
        logger.warn('Unrecognized Deepgram message:', message);
      }
    }
  }

  send(data: Buffer) {
    this.sendOrQueue(data);
  }

  done() {
    this.sendOrQueue({ type: 'CloseStream' });
  }

  private cleanup() {
    const { state, ws } = this;
    if (state.name === 'READY') {
      clearInterval(state.keepaliveTimer);
    }
    ws.removeAllListeners('open');
    ws.removeAllListeners('message');
    ws.removeAllListeners('close');
    ws.removeAllListeners('error');
  }

  terminate() {
    const { state, ws } = this;
    this.cleanup();
    if (state.name !== 'ERROR' && state.name !== 'CLOSED') {
      ws.terminate();
      this.state = { name: 'CLOSED' };
      this.onDone();
    }
  }
}

export class DeepgramPool {
  private poolSize: number;
  private connections: Array<DeepgramConnection> = [];

  constructor(init: { poolSize?: number }) {
    const { poolSize = DEFAULT_POOL_SIZE } = init;
    this.poolSize = poolSize;
    this.fillPool();
  }

  private fillPool() {
    const { poolSize, connections } = this;
    while (connections.length < poolSize) {
      connections.push(this.createConnection());
    }
  }

  private createConnection() {
    return new DeepgramConnection({
      onText: (_text: string) => {},
      onError: (_error: Error) => {},
      onDone: () => {},
    });
  }

  get() {
    const { connections } = this;
    const connection = connections.shift() ?? this.createConnection();
    this.fillPool();
    return connection;
  }
}

function toString(input: Buffer | ArrayBuffer | Array<Buffer>) {
  if (Buffer.isBuffer(input)) {
    return input.toString('utf8');
  }
  if (Array.isArray(input)) {
    return Buffer.concat(input).toString('utf8');
  }
  return Buffer.from(input).toString('utf8');
}

function toArray(input: unknown): Array<unknown> {
  return Array.isArray(input) ? input : [];
}
