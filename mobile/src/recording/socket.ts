/**
 * TODO: Consider replacing createListenerManager with something like promise.race
 */
import { API_BASE_URL } from '../support/constants';
import { sleep } from '../support/sleep';
import { createListenerManager } from '../websockets/createListenerManager';
import { toWebSocketUrl } from '../websockets/toWebSocketUrl';

const MAX_WRITE_BUFFER = 64 * 1024;

type Message = Record<string, unknown>;

type WaitForMessageOptions = {
  timeout?: number;
  signal?: AbortSignal;
  messageTypeForDebugging?: string;
};

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
    const ws = this.getWebSocket('send');
    ws.send(JSON.stringify(message));
    await flush(ws);
  }

  async waitForMessageOfType(
    type: string,
    options: WaitForMessageOptions = {},
  ) {
    const ws = this.getWebSocket('waitForMessageOfType');
    return await waitForMessage(ws, (m) => m.type === type, {
      ...options,
      messageTypeForDebugging: type,
    });
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
  options?: WaitForMessageOptions,
) {
  const { timeout = 5000, signal, messageTypeForDebugging } = options ?? {};
  return new Promise<Message>((resolve, reject) => {
    const cleanup = () => {
      ws.removeEventListener('message', onMessage);
      ws.removeEventListener('close', onClose);
      signal?.removeEventListener('abort', onAbort);
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
    const onAbort = () => {
      cleanup();
      reject(new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort);
    const onTimeout = () => {
      cleanup();
      const errorMessage = 'Timeout waiting for message';
      reject(
        new Error(
          messageTypeForDebugging
            ? errorMessage + ' ' + messageTypeForDebugging
            : errorMessage,
        ),
      );
    };
    const timer = timeout > 0 ? setTimeout(onTimeout, timeout) : null;
    const onClose = (_event: CloseEvent) => {
      cleanup();
      const errorMessage = 'Socket closed while waiting for message';
      reject(
        new Error(
          messageTypeForDebugging
            ? errorMessage + ' ' + messageTypeForDebugging
            : errorMessage,
        ),
      );
    };
    ws.addEventListener('close', onClose);
    const onMessage = (event: MessageEvent) => {
      const data: unknown = event.data;
      const message: Message = typeof data === 'string' ? safeParse(data) : {};
      if (!matcher || matcher(message)) {
        cleanup();
        resolve(message);
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

function isObject(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input);
}

function safeParse(input: string): Record<string, unknown> {
  try {
    const value = JSON.parse(input);
    return isObject(value) ? value : { value };
  } catch {
    return {};
  }
}
