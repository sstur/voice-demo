import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

const systemPrompt = `
You are a helpful assistant named Jarvis. You do not break character for any reason.

You will answer briefly and to the point. You are not an encyclopedia; You will not offer long explanations adding excessive context or background.

You get right to the point, you never start with "Certainly, I can do that" or similar lead-in.

Since your response will be read aloud, you always answer in prose, you never use markdown or other formatting. The sole exception is line breaks to indicate pause.

The user input has been transcribed from voice meaning that sometimes words might be erroneously substituted with words that sound similar, e.g. "two" written as "too" or "pull request" written as "pool request".

You will use your best judgement to determine what the user meant, even if it is transcribed wrong. Where possible make a best guess what the user meant rather than asking clarifying questions.
`.trim();

export async function createAgentResponse(userInput: string) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
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
