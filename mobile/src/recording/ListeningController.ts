import { once } from '../support/once';
import { safeInvoke } from '../support/safeInvoke';
import { StateClass } from '../support/StateClass';
import { startRecording, stopRecording } from './Recording';
import type { Socket } from './socket';

export class ListeningController extends StateClass {
  socket: Socket;
  state:
    | { name: 'NONE' }
    | { name: 'INITIALIZING' }
    | { name: 'ERROR'; error: string }
    | { name: 'LISTENING' }
    | { name: 'STOPPING' };
  onError: (error: unknown) => void;
  onDone: (transcription: string) => void;

  constructor(init: {
    socket: Socket;
    onError: (error: unknown) => void;
    onDone: (transcription: string) => void;
  }) {
    super();
    const { socket, onError, onDone } = init;
    this.socket = socket;
    this.state = { name: 'NONE' };
    this.onError = once(onError);
    this.onDone = once((transcription) => {
      void stopRecording();
      onDone(transcription);
    });
  }

  async start() {
    this.state = { name: 'INITIALIZING' };
    const startTime = Date.now();
    // Next we're doing two things, telling the server to start and starting the local microphone.
    // TODO: Do these two things in parallel, aborting the other if one fails.
    void this.socket.send({ type: 'START_UPLOAD_STREAM' });
    // { type: 'START_UPLOAD_STREAM_RESULT', success: true } | { type: 'START_UPLOAD_STREAM_RESULT', success: false, error: string }
    const message = await this.socket.waitForMessage(
      'START_UPLOAD_STREAM_RESULT',
    );
    if (!message.success) {
      const errorMessage = String(message.error);
      this.state = { name: 'ERROR', error: errorMessage };
      this.onError(errorMessage);
      return;
    }
    // TODO: abort when we transition out of state LISTENING?
    const abortController = new AbortController();
    void this.socket
      .waitForMessage('TRANSCRIPTION_COMPLETE', {
        timeout: 0,
        signal: abortController.signal,
      })
      .then((message) => {
        const transcription = String(message.transcription);
        this.onDone(transcription);
      });
    const result = await safeInvoke(() => startRecording());
    if (!result.ok) {
      const errorMessage = String(result.error);
      this.state = { name: 'ERROR', error: errorMessage };
      this.onError(errorMessage);
      return;
    }
    void this.socket.send({ type: 'RECORDING_STARTED' });
    const timeElapsed = Date.now() - startTime;
    console.log(`>> Started listening in ${timeElapsed}ms`);
    this.state = { name: 'LISTENING' };
    const readableStream = result.result;
    this.sendStream(readableStream)
      .catch((error: unknown) => {
        // This means either the recording errored or a websocket issue
        this.state = { name: 'ERROR', error: String(error) };
        this.onError(error);
      })
      .finally(() => {
        // Stop listening for the TRANSCRIPTION_COMPLETE message from server
        abortController.abort();
      });
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
