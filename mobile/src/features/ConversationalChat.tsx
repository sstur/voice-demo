import { Button, Text, VStack } from '../components/core';
import { useAudioPlayback } from '../context/AudioPlayback';
import { sleep } from '../support/sleep';
import { audioClipPcm as audioClipPcmBase64 } from './audioClipPcm';

// This must be a multiple of 16 because it will be decoded from base64 (x / 4 * 3) then converted into float32 frames (x / 4).
const CHUNK_SIZE = 16 * 1024;

export function ConversationalChat() {
  const { playSound } = useAudioPlayback();

  return (
    <VStack flex={1} justifyContent="center" alignItems="center">
      <Text>{t('Ready')}</Text>
      <Button
        onPress={() => {
          const audioStream = getAudioStream(audioClipPcmBase64);
          void playSound(audioStream, {
            channels: 1,
            sampleRate: 16000,
          });
        }}
      >
        {t('Start')}
      </Button>
    </VStack>
  );
}

async function* getAudioStream(
  fullPcmBase64: string,
): AsyncIterableIterator<string> {
  const length = fullPcmBase64.length;
  for (let i = 0; i < length; i += CHUNK_SIZE) {
    if (i > 0) {
      await sleep(50);
    }
    const chunk = fullPcmBase64.slice(i, i + CHUNK_SIZE);
    yield chunk;
  }
}
