import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

import { RECORDING_OPTIONS } from './constants';
import { createAsyncReadable } from './createAsyncReadable';
import { File } from './File';

type RecordingState =
  | { name: 'IDLE' }
  | { name: 'STARTING'; shouldAbort: boolean }
  | { name: 'RECORDING'; recording: Audio.Recording; file: File }
  | { name: 'STOPPING' };

type Ref<T> = { current: T };

const recordingState: Ref<RecordingState> = { current: { name: 'IDLE' } };

function shouldAbort(state: RecordingState) {
  return state.name === 'STARTING' && state.shouldAbort;
}

export async function startRecording() {
  if (recordingState.current.name !== 'IDLE') {
    const state = recordingState.current;
    throw new Error(`Cannot start recording in state ${state.name}`);
  }
  recordingState.current = { name: 'STARTING', shouldAbort: false };
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
  if (shouldAbort(recordingState.current)) {
    recordingState.current = { name: 'IDLE' };
    throw new Error('Initialization Aborted');
  }
  const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
  if (shouldAbort(recordingState.current)) {
    recordingState.current = { name: 'STOPPING' };
    void stopAndUnloadAsync(recording).finally(() => {
      recordingState.current = { name: 'IDLE' };
    });
    throw new Error('Initialization Aborted');
  }
  const fileUri = recording.getURI() ?? '';
  const file = new File(fileUri);
  recordingState.current = { name: 'RECORDING', recording, file };

  return createAsyncReadable(file, () => {
    FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(
      (error: unknown) => {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.error(`Error deleting file "${fileUri}";`, error);
        }
      },
    );
  });
}

export async function stopRecording() {
  const state = recordingState.current;
  if (state.name === 'STARTING') {
    recordingState.current = { name: 'STARTING', shouldAbort: true };
    return;
  }
  if (state.name === 'IDLE' || state.name === 'STOPPING') {
    return;
  }
  recordingState.current = { name: 'STOPPING' };
  const { recording, file } = state;
  try {
    // This can never throw, so there's not really any use in the try/finally
    await stopAndUnloadAsync(recording);
  } finally {
    recordingState.current = { name: 'IDLE' };
    // This indicates that we're done done writing to the file.
    file.close();
  }
}

async function stopAndUnloadAsync(recording: Audio.Recording) {
  try {
    await recording.stopAndUnloadAsync();
  } catch (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('Error calling recording.stopAndUnloadAsync():', error);
    }
  }
}
