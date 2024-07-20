export function toWebSocketUrl(url: string) {
  const { protocol, host, pathname, search } = new URL(url);
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  return wsProto + '//' + host + pathname + search;
}
