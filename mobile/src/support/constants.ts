import Constants from 'expo-constants';

export const API_BASE_URL = getApiBaseUrl();

export const AUTH_TOKEN_KEY = 'AUTH_TOKEN';

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

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
