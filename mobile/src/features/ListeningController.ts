import { once } from '../support/once';
import { startRecording, stopRecording } from '../support/Recording';
import { safeInvoke } from '../support/safeInvoke';
import type { Socket } from '../support/socket';
import { StateClass } from '../support/StateClass';

export class ListeningController extends StateClass {
  private socket: Socket;
  state:
    | { name: 'NONE' }
    | { name: 'INITIALIZING' }
    | { name: 'ERROR'; error: unknown }
    | { name: 'LISTENING' }
    | { name: 'STOPPED' };
  private abortController: AbortController;
  private onError: (error: unknown) => void;
  private onDone: (transcription: string) => void;

  constructor(init: {
    socket: Socket;
    onError: (error: unknown) => void;
    onDone: (transcription: string) => void;
  }) {
    super();
    const { socket, onError, onDone } = init;
    this.socket = socket;
    this.state = { name: 'NONE' };
    this.abortController = new AbortController();
    this.onError = once((error) => {
      this.state = { name: 'ERROR', error };
      this.cleanup();
      onError(error);
    });
    this.onDone = once((transcription) => {
      // For some reason this is getting called after error above.
      if (this.state.name === 'ERROR') {
        return;
      }
      this.state = { name: 'STOPPED' };
      this.cleanup();
      onDone(transcription);
    });
  }

  private cleanup() {
    // Stop listening for the START_UPLOAD_STREAM_RESULT or TRANSCRIPTION_COMPLETE message
    this.abortController.abort();
    void stopRecording();
  }

  async start() {
    this.state = { name: 'INITIALIZING' };
    // Next we're doing two things, telling the server to start and starting the local microphone.
    // TODO: Do these two things in parallel, aborting the other if one fails.
    void this.socket.send({ type: 'START_UPLOAD_STREAM' });
    this.abortController = new AbortController();
    // { type: 'START_UPLOAD_STREAM_RESULT', success: true } | { type: 'START_UPLOAD_STREAM_RESULT', success: false, error: string }
    const message = await this.socket.waitForMessage(
      'START_UPLOAD_STREAM_RESULT',
      { signal: this.abortController.signal },
    );
    if (!message.success) {
      this.onError(message.error);
      return;
    }
    this.abortController = new AbortController();
    this.socket
      .waitForMessage('TRANSCRIPTION_COMPLETE', {
        timeout: 0,
        signal: this.abortController.signal,
      })
      .then((message) => {
        const transcription = String(message.transcription);
        this.onDone(transcription);
      })
      .catch((error: unknown) => {
        if (error instanceof Error) {
          if (error.message === 'Aborted') {
            return;
          }
        }
        // eslint-disable-next-line no-console
        console.log('Error while waiting for TRANSCRIPTION_COMPLETE', error);
      });
    const result = await safeInvoke(() => startRecording());
    if (!result.ok) {
      this.onError(result.error);
      return;
    }
    void this.socket.send({ type: 'LOG_RECORDING_STARTED' });
    this.state = { name: 'LISTENING' };
    const readableStream = result.result;
    this.sendStream(readableStream).catch((error: unknown) => {
      // This means either the recording errored or a websocket issue
      this.onError(error);
    });
  }

  stop() {
    // This will cause the audio stream to end, sending AUDIO_DONE to the server
    void stopRecording();
  }

  terminate() {
    this.state = { name: 'STOPPED' };
    this.cleanup();
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
