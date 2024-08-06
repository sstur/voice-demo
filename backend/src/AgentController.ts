import type { ChatCompletionMessageParam as Message } from 'openai/resources';

import { createAgentResponse } from './agent';
import type { AsyncQueue } from './support/AsyncQueue';
import { createId } from './support/createId';
import { TextToSpeechController } from './TextToSpeechController';
import { voiceResponseStore } from './voiceResponseStore';

export class AgentController {
  state: { name: 'NONE' } = { name: 'NONE' };
  conversation: Array<Message>;
  contextId: string;
  outputQueue: AsyncQueue<Buffer>;
  onError: (error: unknown) => void;
  onFinalTextResponse: (content: string) => void;
  onDone: () => void;

  constructor(init: {
    conversation: Array<Message>;
    onError: (error: unknown) => void;
    onFinalTextResponse: (content: string) => void;
    onDone: () => void;
  }) {
    const { conversation, onError, onFinalTextResponse, onDone } = init;
    this.conversation = conversation;
    const contextId = (this.contextId = createId());
    this.outputQueue = voiceResponseStore.create(contextId);
    this.onError = onError;
    this.onFinalTextResponse = onFinalTextResponse;
    this.onDone = onDone;
  }

  async start() {
    const { conversation, onError, onDone } = this;
    const _responseStream = await createAgentResponse(conversation);
    const textToSpeechController = new TextToSpeechController({
      // inputStream: responseStream,
      // contextId,
      onError: (error) => onError(error),
      onDone: () => onDone(),
    });
    await textToSpeechController.start();
  }

  getOutputUrl() {
    const { contextId } = this;
    return `/playback/${contextId}`;
  }
}
