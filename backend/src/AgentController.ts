import type { ChatCompletionMessageParam as Message } from 'openai/resources';

import { createAgentResponse } from './agent';
import { AsyncQueue } from './support/AsyncQueue';
import type { AudioMetaData } from './TextToSpeechController';
import { TextToSpeechController } from './TextToSpeechController';

type State =
  | { name: 'IDLE' }
  | { name: 'RUNNING'; textToSpeechController: TextToSpeechController }
  | { name: 'ERROR'; error: unknown }
  | { name: 'CLOSED' };

export class AgentController {
  state: State = { name: 'IDLE' };
  private conversation: Array<Message>;
  outputQueue: AsyncQueue<string>;
  private onAudioMeta: (meta: AudioMetaData) => void;
  private abortController: AbortController;
  private onError: (error: unknown) => void;
  private onFinalTextResponse: (content: string) => void;
  private onDone: () => void;
  private voiceId: string | undefined;

  constructor(init: {
    conversation: Array<Message>;
    onAudioMeta: (meta: AudioMetaData) => void;
    onError: (error: unknown) => void;
    onFinalTextResponse: (content: string) => void;
    onDone: () => void;
    voiceId: string | undefined;
  }) {
    const {
      conversation,
      onAudioMeta,
      onError,
      onFinalTextResponse,
      onDone,
      voiceId,
    } = init;
    this.conversation = conversation;
    this.outputQueue = new AsyncQueue<string>();
    this.onAudioMeta = onAudioMeta;
    this.abortController = new AbortController();
    this.onError = onError;
    this.onFinalTextResponse = onFinalTextResponse;
    this.onDone = onDone;
    this.voiceId = voiceId;
  }

  async start() {
    const { conversation, outputQueue, onError, onDone } = this;
    const responseStream = await createAgentResponse(conversation, {
      abortSignal: this.abortController.signal,
    });
    const textToSpeechController = new TextToSpeechController({
      inputStream: responseStream,
      voiceId: this.voiceId,
      onFinalTextResponse: this.onFinalTextResponse,
      onAudioChunk: (chunk) => {
        void outputQueue.write(chunk);
      },
      onAudioMeta: this.onAudioMeta,
      onError: (error) => {
        if (this.state.name === 'RUNNING') {
          this.state = { name: 'ERROR', error };
          outputQueue.close();
          onError(error);
        }
      },
      onDone: () => {
        if (this.state.name === 'RUNNING') {
          this.state = { name: 'CLOSED' };
          outputQueue.close();
          onDone();
        }
      },
    });
    this.state = { name: 'RUNNING', textToSpeechController };
    await textToSpeechController.start();
  }

  terminate() {
    this.abortController.abort();
    const { state, outputQueue } = this;
    if (state.name === 'RUNNING') {
      const { textToSpeechController } = state;
      outputQueue.close();
      textToSpeechController.terminate();
      // TODO: Do we need to call onDone()?
    }
  }
}
