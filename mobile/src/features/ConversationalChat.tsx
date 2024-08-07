import { useRef } from 'react';
import { WebView } from 'react-native-webview';

import { parseMessage } from '../support/parseMessage';

export function ConversationalChat() {
  const webViewRef = useRef<WebView>(null);

  const send = (data: Record<string, unknown>) => {
    webViewRef.current?.postMessage(JSON.stringify(data));
  };

  return (
    <WebView
      ref={webViewRef}
      style={{ flex: 1 }}
      source={{ uri: 'http://localhost:8000/audio-player.html' }}
      onMessage={(event) => {
        const data = parseMessage(event.nativeEvent.data);
        switch (data.type) {
          case 'READY': {
            send({ type: 'LOG', value: 'Hello world' });
            break;
          }
          case 'LOG': {
            const { args } = data;
            if (Array.isArray(args)) {
              // eslint-disable-next-line no-console
              console.log(...args);
            }
            break;
          }
        }
      }}
    />
  );
}
