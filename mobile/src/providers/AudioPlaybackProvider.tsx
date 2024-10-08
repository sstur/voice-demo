import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Audio } from 'expo-av';
import { WebView } from 'react-native-webview';

import type {
  AudioPlaybackContext,
  PlaybackInstance,
  PlaybackOptions,
} from '../context/AudioPlayback';
import { AudioPlaybackContextProvider } from '../context/AudioPlayback';
import { audioPlayerWebViewHtml } from '../support/audioPlayerWebViewHtml';
import { parseMessage } from '../support/parseMessage';

type AudioClip = {
  id: string;
  audioStream: AsyncIterable<string>;
  options: PlaybackOptions;
};

function AudioPlaybackWebView(props: { audioClip: AudioClip }) {
  const { audioClip } = props;
  const { channels, sampleRate, abortController, onStart, onDone } =
    audioClip.options;
  const webViewRef = useRef<WebView>(null);

  const send = (data: Record<string, unknown>) => {
    webViewRef.current?.postMessage(JSON.stringify(data));
  };

  useEffect(() => {
    const onAbort = () => send({ type: 'STOP' });
    abortController.signal.addEventListener('abort', onAbort);
    return () => {
      abortController.signal.removeEventListener('abort', onAbort);
    };
  }, [abortController]);

  const startStreaming = async () => {
    const { audioStream } = audioClip;
    let hasStarted = false;

    // TODO: Each chunk must be a base64 encoded string whose length is multiple
    // of 16 because it will be decoded from base64 (x / 4 * 3) then converted
    // into float32 frames (x / 4).
    for await (const chunk of audioStream) {
      if (abortController.signal.aborted) {
        break;
      }
      if (!hasStarted) {
        onStart?.();
        hasStarted = true;
      }
      send({ type: 'AUDIO_CHUNK', value: chunk });
    }
    send({ type: 'AUDIO_DONE' });
  };

  const html = htmlWithParams({ channels, sampleRate });

  return (
    <View style={{ height: 0 }}>
      <WebView
        ref={webViewRef}
        style={{ height: 0 }}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(event) => {
          const data = parseMessage(event.nativeEvent.data);
          switch (data.type) {
            case 'READY': {
              if (!abortController.signal.aborted) {
                void startStreaming();
              }
              break;
            }
            case 'PLAYBACK_COMPLETE': {
              onDone?.();
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
    </View>
  );
}

export function AudioPlaybackProvider(props: { children: ReactNode }) {
  const [playing, setPlaying] = useState<AudioClip | null>(null);
  const idRef = useRef(0);

  const playSound = useCallback(
    async (
      audioStream: AsyncIterable<string>,
      options: PlaybackOptions,
    ): Promise<PlaybackInstance> => {
      // TODO: This doesn't seem to work.
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      const id = String(idRef.current++);
      setPlaying({
        id,
        audioStream,
        options: {
          ...options,
          onDone: () => {
            setPlaying(null);
            options.onDone?.();
          },
        },
      });
      return {
        // TODO
        stop: () => {},
      };
    },
    [],
  );

  const contextValue = useMemo<AudioPlaybackContext>(() => {
    return { playSound };
  }, [playSound]);

  return (
    <AudioPlaybackContextProvider value={contextValue}>
      <View style={{ flex: 1 }}>
        {playing ? (
          <AudioPlaybackWebView key={playing.id} audioClip={playing} />
        ) : null}
        {props.children}
      </View>
    </AudioPlaybackContextProvider>
  );
}

function htmlWithParams(inputParams: { channels: number; sampleRate: number }) {
  return audioPlayerWebViewHtml.replace(
    'const inputParams = {}',
    `const inputParams = ${JSON.stringify(inputParams)}`,
  );
}
