import { useState } from 'react';

import { Button, Text, VStack } from '../components/core';
import { useAudioPlayback } from '../context/AudioPlayback';
import { Socket } from '../recording/socket';

export function ConversationalChat() {
  const audioPlaybackContext = useAudioPlayback();
  const [isPlaying, setPlaying] = useState(false);

  const playAudioFromServer = async () => {
    const socket = new Socket();
    await socket.open('/sockets/audio-test');
    const audioStream = getAudioStream(socket);
    await new Promise<void>((resolve) => {
      void audioPlaybackContext.playSound(audioStream, {
        channels: 1,
        sampleRate: 16000,
        onDone: () => {
          console.log(`Playback complete.`);
          resolve();
        },
      });
    });
    await socket.close();
  };

  return (
    <VStack flex={1} justifyContent="center" alignItems="center">
      {isPlaying ? (
        <Text>{t('Playing...')}</Text>
      ) : (
        <>
          <Text>{t('Ready')}</Text>
          <Button
            onPress={() => {
              setPlaying(true);
              playAudioFromServer()
                .catch((error: unknown) => {
                  console.error(error);
                })
                .finally(() => {
                  setPlaying(false);
                });
            }}
          >
            {t('Play audio')}
          </Button>
        </>
      )}
    </VStack>
  );
}

function getAudioStream(socket: Socket): AsyncIterable<string> {
  const stream = socket.getIterableStream<string>('AUDIO_CHUNK', (message) => {
    const { value, done } = message;
    return done
      ? { value: undefined, done: true }
      : { value: String(value), done: false };
  });
  void socket.send({ type: 'START_PLAYBACK' });
  return stream;
}
