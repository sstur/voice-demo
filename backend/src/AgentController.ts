import { createAgentResponse } from './agent';
import { AsyncQueue } from './support/AsyncQueue';
import { createId } from './support/createId';
import { VoiceController } from './VoiceController';
import { voiceResponseStore } from './voiceResponseStore';

export class AgentController {
  state: { name: 'NONE' } = { name: 'NONE' };
  userInput: string;
  contextId: string;
  outputQueue: AsyncQueue<Buffer>;
  onError: (error: unknown) => void;
  onDone: () => void;

  constructor(init: {
    userInput: string;
    onError: (error: unknown) => void;
    onDone: () => void;
  }) {
    const { userInput, onError, onDone } = init;
    this.userInput = userInput;
    const contextId = (this.contextId = createId());
    const outputQueue = (this.outputQueue = new AsyncQueue<Buffer>());
    voiceResponseStore.set(contextId, outputQueue);
    this.onError = onError;
    this.onDone = onDone;
  }

  async start() {
    const { userInput, contextId, outputQueue, onError, onDone } = this;
    const responseStream = await createAgentResponse(userInput);
    const voiceController = new VoiceController({
      inputStream: responseStream,
      contextId,
      onChunk: (chunk) => {
        void outputQueue.write(chunk);
      },
      onError: (error) => onError(error),
      onDone: () => onDone(),
    });
    await voiceController.start();
  }

  getOutputUrl() {
    const { contextId } = this;
    return `/playback/${contextId}`;
  }
}
