import { Audio } from 'expo-av';
import Constants from 'expo-constants';

export const API_BASE_URL = getApiBaseUrl();

export const AUTH_TOKEN_KEY = 'AUTH_TOKEN';

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

// The following is based off of Audio.RecordingOptionsPresets.HIGH_QUALITY
export const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  ios: {
    extension: '.aac',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    extension: '.aac',
    outputFormat: Audio.AndroidOutputFormat.AAC_ADTS,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

function getApiBaseUrl(): string {
  const apiHostFromEnv = process.env.EXPO_PUBLIC_API_HOST;
  if (apiHostFromEnv) {
    return apiHostFromEnv;
  }
  const { expoConfig } = Constants;
  if (__DEV__) {
    // In dev, hostUri is available from mobile (but not web)
    const host = expoConfig?.hostUri ?? 'localhost';
    const hostname = host.split(':')[0] ?? '';
    return `http://${hostname}:8000`;
  }
  const host: unknown = expoConfig?.extra?.productionApiHost;
  if (typeof host !== 'string') {
    throw new Error('Missing "productionApiHost" in app.json');
  }
  return host;
}
