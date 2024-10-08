import { AsyncQueue } from './AsyncQueue';
import { API_BASE_URL } from './constants';
import { sleep } from './sleep';
import { toWebSocketUrl } from './toWebSocketUrl';

const MAX_WRITE_BUFFER = 64 * 1024;

type Message = Record<string, unknown>;

type WaitForMessageOptions = {
  timeout?: number;
  signal?: AbortSignal;
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

  async waitForMessage(type: string, options: WaitForMessageOptions = {}) {
    const ws = this.getWebSocket('waitForMessage');
    return await waitForMessage(ws, type, options);
  }

  getIterableStream<T>(
    type: string,
    toResult: (message: Message) => IteratorResult<T, undefined>,
    abortController: AbortController,
  ): AsyncIterableIterator<T> {
    const asyncQueue = new AsyncQueue<T>();
    abortController.signal.addEventListener('abort', () => {
      cleanupEventListeners();
      asyncQueue.close();
    });
    const ws = this.getWebSocket('getIterable');

    const cleanupEventListeners = addListeners(ws, {
      close: () => {
        cleanupEventListeners();
        asyncQueue.close();
      },
      message: (event: MessageEvent) => {
        const data: unknown = event.data;
        const message: Message =
          typeof data === 'string' ? safeParse(data) : {};
        if (message.type === type) {
          const { value, done } = toResult(message);
          if (value !== undefined) {
            void asyncQueue.write(value);
          }
          if (done) {
            cleanupEventListeners();
            asyncQueue.close();
          }
        }
      },
    });
    return asyncQueue;
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
    const cleanupEventListeners = addListeners(ws, {
      error: () => {
        cleanupEventListeners();
        reject(new Error('Error opening WebSocket'));
      },
      close: () => {
        cleanupEventListeners();
        reject(
          new Error(
            'Error opening WebSocket: Server closed connection unexpectedly',
          ),
        );
      },
      open: () => {
        cleanupEventListeners();
        resolve();
      },
    });
  });
}

function waitForMessage(
  ws: WebSocket,
  type: string,
  options?: WaitForMessageOptions,
) {
  const { timeout = 5000, signal } = options ?? {};
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
      reject(new Error(`Timeout waiting for message "${type}"`));
    };
    const timer = timeout > 0 ? setTimeout(onTimeout, timeout) : null;
    const onClose = (_event: CloseEvent) => {
      cleanup();
      reject(new Error(`Socket closed while waiting for message "${type}"`));
    };
    ws.addEventListener('close', onClose);
    const onMessage = (event: MessageEvent) => {
      const data: unknown = event.data;
      const message: Message = typeof data === 'string' ? safeParse(data) : {};
      if (message.type === type) {
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
    const cleanupEventListeners = addListeners(ws, {
      error: () => {
        cleanupEventListeners();
        reject(new Error('Error closing WebSocket'));
      },
      close: () => {
        cleanupEventListeners();
        resolve();
      },
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

/**
 * Add a set of event listeners, returning a cleanup function to remove them all.
 */
function addListeners(
  ws: WebSocket,
  listeners: {
    [K in keyof WebSocketEventMap]?: (event: WebSocketEventMap[K]) => void;
  },
) {
  const abortController = new AbortController();
  for (const [eventName, listener] of Object.entries(listeners)) {
    ws.addEventListener(
      eventName,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      listener as never,
      { signal: abortController.signal },
    );
  }
  return () => abortController.abort();
}
