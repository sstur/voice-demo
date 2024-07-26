import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

export async function createAgentResponse(userInput: string) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: userInput,
      },
    ],
    stream: true,
  });
  // eslint-disable-next-line functions/top-level-fn-decl
  const getAsyncIterator = async function* (): AsyncIterableIterator<string> {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  };
  return getAsyncIterator();
}
