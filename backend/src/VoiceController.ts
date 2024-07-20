export class VoiceController {
  inputStream: AsyncIterator<string, undefined>;
  onChunk: (chunk: Buffer) => void;
  onDone: () => void;

  constructor(init: {
    inputStream: AsyncIterator<string, undefined>;
    onChunk: (chunk: Buffer) => void;
    onDone: () => void;
  }) {
    const { inputStream, onChunk, onDone } = init;
    this.inputStream = inputStream;
    this.onChunk = onChunk;
    this.onDone = onDone;
  }

  async start() {
    // TODO
  }
}
