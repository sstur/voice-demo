import { WebSocket } from 'ws';

import { AsyncQueue } from './AsyncQueue';
import { DEEPGRAM_KEY, DEEPGRAM_WSS_URL } from './constants';
import { eventLogger } from './EventLogger';
import { logger } from './Logger';
import { parseMessage } from './parseMessage';

const KEEPALIVE_INTERVAL_MS = 2000;

type State =
  | { name: 'INITIALIZING'; queue: Array<Buffer | Record<string, unknown>> }
  | { name: 'READY'; keepaliveTimer: IntervalId }
  | { name: 'ERROR'; error: unknown }
  | { name: 'CLOSED' };

export class DeepgramConnection implements AsyncIterable<string> {
  private state: State;
  private ws: WebSocket;
  private asyncQueue: AsyncQueue<string>;
  private audioBytesSent = 0;
  /** The number of characters received */
  private receivedCharCount = 0;
  /** The number chunks of text received (including empty ones) */
  private receivedChunkCount = 0;

  constructor() {
    this.state = { name: 'INITIALIZING', queue: [] };
    this.asyncQueue = new AsyncQueue();

    const url = new URL(DEEPGRAM_WSS_URL);
    url.searchParams.set('model', 'nova-2-conversationalai');
    url.searchParams.set('endpointing', '400');
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
        this.asyncQueue.close();
      }
    });

    ws.on('error', (error) => {
      logger.warn('Deepgram connection experienced an error:', error);
      this.cleanup();
      this.state = { name: 'ERROR', error };
      this.asyncQueue.close();
    });

    this.ws = ws;
  }

  private sendImmediate(data: Buffer | Record<string, unknown>) {
    const { state } = this;
    if (state.name !== 'READY') {
      logger.warn(
        `Attempted send while DeepgramConnection in state ${state.name}`,
      );
      return;
    }
    if (Buffer.isBuffer(data)) {
      if (this.audioBytesSent === 0) {
        eventLogger.event('stt_first_audio_chunk_sent');
      }
      this.audioBytesSent += data.length;
      this.ws.send(data);
    } else {
      const message = JSON.stringify(data);
      this.ws.send(message);
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
    switch (message.type) {
      case 'Results': {
        const { channel: _, metadata, ...other } = message;
        // Should look like: { "type": "Results", "channel_index": [0, 1], "duration": 0.061875343, "start": 7.74, "is_final": true, "speech_final": false, "channel": { "alternatives": [{ "transcript": "...", "confidence": 1, "words": [{ "word": "foo", "start": 1.72, "end": 1.96, "confidence": 0.9970703 }] }] }, "metadata": { "request_id": "...", "model_uuid": "...", "model_info": { ... } }, "from_finalize": false }
        const channel = Object(message.channel);
        const result = Object(toArray(channel.alternatives)[0]);
        const transcript = String(result.transcript ?? '');
        // I actually don't believe this is necessary, it comes already trimmed
        const text = transcript.trim();
        if (this.receivedChunkCount === 0) {
          eventLogger.event('stt_first_text_received');
        }
        this.receivedCharCount += text.length;
        this.receivedChunkCount += 1;
        logger.log({ text, ...other });
        if (text) {
          void this.asyncQueue.write(text);
        }
        const hasReceivedText = this.receivedCharCount > 0;
        // We won't terminate this unless we've received at least some text. If
        // we have received text and this particular message contains empty text
        // then that indicates a fairly substantial silence so we can assume
        // the user is done talking. More commonly though we'll get a
        // speech_final and won't need to wait for such a large gap.
        if (hasReceivedText && (text === '' || message.speech_final)) {
          this.terminate();
          break;
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
    eventLogger.event('stt_done');
    const { state, ws } = this;
    this.cleanup();
    if (state.name !== 'ERROR' && state.name !== 'CLOSED') {
      ws.terminate();
      this.state = { name: 'CLOSED' };
      this.asyncQueue.close();
    }
  }

  [Symbol.asyncIterator]() {
    return this.asyncQueue[Symbol.asyncIterator]();
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
