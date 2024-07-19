import { API_BASE_URL } from '../support/constants';
import { openWebSocket } from '../websockets/openWebSocket';
import { toWebSocketUrl } from './toWebSocketUrl';

export async function createAndOpenWebSocket(path: string) {
  const url = toWebSocketUrl(API_BASE_URL + path);
  const ws = new WebSocket(url);
  await openWebSocket(ws);
}
