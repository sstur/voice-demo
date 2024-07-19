import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

import { File } from '../support/File';
import { RECORDING_OPTIONS } from './constants';
import { createAsyncReadable } from './createAsyncReadable';

type RecordingState =
  | { state: 'IDLE' }
  | { state: 'STARTING' }
  | { state: 'RECORDING'; recording: Audio.Recording; file: File }
  | { state: 'STOPPING' };

type Ref<T> = { current: T };

const recordingState: Ref<RecordingState> = { current: { state: 'IDLE' } };

export async function startRecording() {
  if (recordingState.current.state !== 'IDLE') {
    return;
  }
  recordingState.current = { state: 'STARTING' };
  // TODO: Reset back to idle if either of the following two await'd calls throw
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
  const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
  const fileUri = recording.getURI() ?? '';
  const file = new File(fileUri);
  recordingState.current = { state: 'RECORDING', recording, file };

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
  // TODO: If we're in state STARTING, somehow abort
  if (state.state !== 'RECORDING') {
    return;
  }
  const { recording, file } = state;
  recordingState.current = { state: 'STOPPING' };
  try {
    await recording.stopAndUnloadAsync();
  } catch (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('Error calling recording.stopAndUnloadAsync():', error);
    }
  } finally {
    recordingState.current = { state: 'IDLE' };
  }
  // This indicates that we're done done writing to the file.
  file.close();
}
