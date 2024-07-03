import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLocalStorage } from '../support/createLocalStorage';

const prefix = '@ls:';

const store = new Map<string, string>();

const localStorage = createLocalStorage({
  store,
  onChange: (key, value) => {
    if (value === null) {
      void AsyncStorage.removeItem(prefix + key);
    } else {
      void AsyncStorage.setItem(prefix + key, value);
    }
  },
});

async function loadFromAsyncStorage() {
  const keys = await AsyncStorage.getAllKeys();
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      const value = await AsyncStorage.getItem(key);
      if (value != null) {
        store.set(key.slice(prefix.length), value);
      }
    }
  }
}

const loadPromise = loadFromAsyncStorage();

export async function getLocalStorage() {
  await loadPromise;
  return localStorage;
}
