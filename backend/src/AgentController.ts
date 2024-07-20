import { createAgentResponse } from './agent';
import { AsyncQueue } from './support/AsyncQueue';
import { createId } from './support/createId';
import { VoiceController } from './VoiceController';
import { voiceResponseStore } from './voiceResponseStore';

export class AgentController {
  state: { name: 'NONE' } = { name: 'NONE' };
  userInput: string;
  responseId: string;
  outputQueue: AsyncQueue<Buffer>;
  onDone: () => void;

  constructor(init: { userInput: string; onDone: () => void }) {
    const { userInput, onDone } = init;
    this.userInput = userInput;
    const responseId = (this.responseId = createId());
    const outputQueue = (this.outputQueue = new AsyncQueue<Buffer>());
    voiceResponseStore.set(responseId, outputQueue);
    this.onDone = onDone;
  }

  async start() {
    const { userInput, outputQueue, onDone } = this;
    const responseStream = await createAgentResponse(userInput);
    const voiceController = new VoiceController({
      inputStream: responseStream,
      onChunk: (chunk) => {
        void outputQueue.write(chunk);
      },
      onDone: () => onDone(),
    });
    await voiceController.start();
  }

  getOutputUrl() {
    const { responseId } = this;
    return `/playback/${responseId}.m4a`;
  }
}
