import type { ChatCompletionMessageParam as Message } from 'openai/resources';

import { createAgentResponse } from './agent';
import { AsyncQueue } from './support/AsyncQueue';
import { createId } from './support/createId';
import { TextToSpeechController } from './TextToSpeechController';

export class AgentController {
  state: { name: 'NONE' } = { name: 'NONE' };
  private conversation: Array<Message>;
  private contextId: string;
  outputQueue: AsyncQueue<string>;
  private onError: (error: unknown) => void;
  private onFinalTextResponse: (content: string) => void;
  private onDone: () => void;

  constructor(init: {
    conversation: Array<Message>;
    onError: (error: unknown) => void;
    onFinalTextResponse: (content: string) => void;
    onDone: () => void;
  }) {
    const { conversation, onError, onFinalTextResponse, onDone } = init;
    this.conversation = conversation;
    this.contextId = createId();
    this.outputQueue = new AsyncQueue<string>();
    this.onError = onError;
    this.onFinalTextResponse = onFinalTextResponse;
    this.onDone = onDone;
  }

  async start() {
    const { conversation, contextId, outputQueue, onError, onDone } = this;
    const responseStream = await createAgentResponse(conversation);
    const textToSpeechController = new TextToSpeechController({
      inputStream: responseStream,
      contextId,
      onFinalTextResponse: this.onFinalTextResponse,
      onAudioChunk: (chunk) => {
        void outputQueue.write(chunk);
      },
      onError: (error) => {
        outputQueue.close();
        onError(error);
      },
      onDone: () => {
        outputQueue.close();
        onDone();
      },
    });
    await textToSpeechController.start();
  }
}
