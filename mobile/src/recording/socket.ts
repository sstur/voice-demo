/**
 * TODO: Consider replacing createListenerManager with something like promise.race
 */
import { API_BASE_URL } from '../support/constants';
import { sleep } from '../support/sleep';
import { createListenerManager } from '../websockets/createListenerManager';
import { toWebSocketUrl } from '../websockets/toWebSocketUrl';

const MAX_WRITE_BUFFER = 64 * 1024;

type Message = Record<string, unknown>;

// TODO: Rename NONE state?
type SocketState =
  | { name: 'NONE' }
  | { name: 'INITIALIZING' }
  | { name: 'OPEN'; ws: WebSocket }
  | { name: 'CLOSING' }
  | { name: 'CLOSED' }
  | { name: 'ERROR'; error: unknown };

export class Socket {
  state: SocketState = { name: 'NONE' };

  async open(path: string) {
    this.state = { name: 'INITIALIZING' };
    try {
      const url = toWebSocketUrl(API_BASE_URL + path);
      const ws = new WebSocket(url);
      await openWebSocket(ws);
      this.state = { name: 'OPEN', ws };
    } catch (error) {
      this.state = { name: 'ERROR', error };
      throw error;
    }
  }

  async send(message: Message) {
    const ws = this.getWebSocket('write');
    ws.send(JSON.stringify(message));
    await flush(ws);
  }

  async waitForMessage(options?: { timeout?: number }) {
    const ws = this.getWebSocket('waitForMessage');
    return await waitForMessage(ws, undefined, options);
  }

  async waitForMessageOfType(type: string, options?: { timeout?: number }) {
    const ws = this.getWebSocket('waitForMessageOfType');
    return await waitForMessage(ws, (m) => m.type === type, options);
  }

  async close() {
    const ws = this.getWebSocket('close');
    await closeWebSocket(ws);
  }

  getWebSocket(operationName: string) {
    const state = this.state;
    if (state.name !== 'OPEN') {
      throw new Error(
        `Cannot perform operation (${operationName}) while WebSocket is in state ${state.name}`,
      );
    }
    return state.ws;
  }
}

function openWebSocket(ws: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    if (
      ws.readyState === WebSocket.CLOSING ||
      ws.readyState === WebSocket.CLOSED
    ) {
      reject(new Error('Error opening WebSocket: Already closed'));
      return;
    }
    const { addListener, removeAllListeners } = createListenerManager(ws);
    addListener('error', () => {
      removeAllListeners();
      reject(new Error('Error opening WebSocket'));
    });
    addListener('close', () => {
      removeAllListeners();
      reject(
        new Error(
          'Error opening WebSocket: Server closed connection unexpectedly',
        ),
      );
    });
    addListener('open', () => {
      removeAllListeners();
      resolve();
    });
  });
}

function waitForMessage(
  ws: WebSocket,
  matcher?: (message: Message) => boolean,
  options?: { timeout?: number },
) {
  const timeout = options?.timeout ?? 5000;
  return new Promise<Message>((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener('message', onMessage);
      reject(new Error('Timeout waiting for message'));
    }, timeout);
    const onMessage = (event: MessageEvent) => {
      const data: Message = Object(event.data);
      if (!matcher || matcher(data)) {
        ws.removeEventListener('message', onMessage);
        clearTimeout(timer);
        resolve(data);
      }
    };
    ws.addEventListener('message', onMessage);
  });
}

async function flush(ws: WebSocket) {
  while (ws.bufferedAmount > MAX_WRITE_BUFFER) {
    await sleep(100);
  }
}

function closeWebSocket(ws: WebSocket, code?: number, reason?: string) {
  return new Promise<void>((resolve, reject) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    const { addListener, removeAllListeners } = createListenerManager(ws);
    addListener('error', () => {
      removeAllListeners();
      reject(new Error('Error closing WebSocket'));
    });
    addListener('close', () => {
      removeAllListeners();
      resolve();
    });
    ws.close(code, reason);
  });
}