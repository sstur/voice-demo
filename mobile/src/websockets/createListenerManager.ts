export function createListenerManager(ws: WebSocket) {
  const removerFns = new Set<() => void>();

  const addListener = <K extends keyof WebSocketEventMap>(
    type: K,
    listener: (event: WebSocketEventMap[K]) => void,
  ) => {
    ws.addEventListener(type, listener);
    const removeListener = () => {
      ws.removeEventListener(type, listener);
    };
    removerFns.add(removeListener);
    return () => {
      removerFns.delete(removeListener);
      removeListener();
    };
  };

  const removeAllListeners = () => {
    for (const removeListener of removerFns) {
      removeListener();
    }
    removerFns.clear();
  };

  return { addListener, removeAllListeners };
}
