import { safeInvoke } from '../support/safeInvoke';
import { StateClass } from '../support/StateClass';
import { startRecording, stopRecording } from './Recording';
import type { Socket } from './socket';

export class ListeningController extends StateClass {
  socket: Socket;
  state:
    | { name: 'NONE' }
    | { name: 'INITIALIZING' }
    | { name: 'ERROR'; error: unknown }
    | { name: 'LISTENING' }
    | { name: 'STOPPING' };
  onStarted: () => void;
  onError: (error: unknown) => void;
  onDone: () => void;

  constructor(init: {
    socket: Socket;
    onStarted: () => void;
    onError: (error: unknown) => void;
    onDone: () => void;
  }) {
    super();
    const { socket, onStarted, onError, onDone } = init;
    this.socket = socket;
    this.state = { name: 'NONE' };
    this.onStarted = onStarted;
    this.onError = onError;
    this.onDone = onDone;
  }

  async start() {
    this.state = { name: 'INITIALIZING' };
    // TODO: abort when we transition out of state LISTENING?
    const abortController = new AbortController();
    void this.socket
      .waitForMessageOfType('STOP_UPLOAD_STREAM', {
        timeout: 0,
        signal: abortController.signal,
      })
      .then(() => {
        this.stop();
      });
    const result = await safeInvoke(() => startRecording());
    if (!result.ok) {
      const { error } = result;
      this.state = { name: 'ERROR', error };
      this.onError(error);
      return;
    }
    this.state = { name: 'LISTENING' };
    this.onStarted();
    const readableStream = result.result;
    this.sendStream(readableStream)
      .then(() => {
        // This means we called stopRecording(), e.g. from a STOP_UPLOAD_STREAM message from the server
        this.onDone();
      })
      .catch((error: unknown) => {
        // This means either the recording errored or a websocket issue
        this.state = { name: 'ERROR', error };
        this.onError(error);
      })
      .finally(() => {
        // Stop listening for the STOP_UPLOAD_STREAM message from server
        abortController.abort();
      });
  }

  stop() {
    // This will cause the sendStream to finish up, calling onDone.
    void stopRecording();
  }

  private async sendStream(readableStream: AsyncGenerator<string, undefined>) {
    const { socket } = this;
    // TODO: Use for..await
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
    while (true) {
      const { value, done } = await readableStream.next();
      if (value) {
        await socket.send({ type: 'AUDIO_CHUNK', value });
      }
      if (done) {
        break;
      }
    }
    await socket.send({ type: 'AUDIO_DONE' });
  }
}
