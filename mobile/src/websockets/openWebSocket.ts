import { createListenerManager } from './createListenerManager';

export function openWebSocket(ws: WebSocket) {
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
