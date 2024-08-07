import { useRef } from 'react';
import { WebView } from 'react-native-webview';

import { parseMessage } from '../support/parseMessage';
import { sleep } from '../support/sleep';

const CHUNK_SIZE = 12 * 1024;

export function ConversationalChat() {
  const webViewRef = useRef<WebView>(null);

  const send = (data: Record<string, unknown>) => {
    webViewRef.current?.postMessage(JSON.stringify(data));
  };

  const startStreaming = async () => {
    const response = await fetch('http://localhost:8000/audio.pcm');
    const base64 = await response.text();
    const length = base64.length;
    for (let i = 0; i < length; i += CHUNK_SIZE) {
      if (i > 0) {
        await sleep(100);
      }
      const chunk = base64.slice(i, i + CHUNK_SIZE);
      send({ type: 'AUDIO_CHUNK', value: chunk });
    }
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
            // send({ type: 'LOG', value: 'Hello world' });
            void startStreaming();
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
