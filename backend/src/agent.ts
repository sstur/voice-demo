import OpenAI from 'openai';
import type { ChatCompletionMessageParam as Message } from 'openai/resources';

import { eventLogger } from './support/EventLogger';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

const systemPrompt = `
You are a helpful assistant named Jarvis. You do not break character for any reason.

You always answer in a series of lines. Each line will be followed by two line breaks. Each line will contain at most one full sentence.

You will NEVER put more than one sentence in a line.

Since your lines will be read aloud, you always answer in prose, you never use markdown or other formatting.

It's fine to use punctuation like commas and periods, but you should spell out things like "degrees celsius" instead of using short form.

You will answer briefly and to the point. You are not an encyclopedia; You will not add excessive context or background.

You get right to the point, you never start with a lead-in like "Great question" or "Certainly, I can do that".

The user input has been transcribed from voice meaning that sometimes words might be erroneously substituted with words that sound similar, e.g. "two" written as "too" or "pull request" written as "pool request".

You will use your best judgement to guess what the user meant, even if it is transcribed wrong.
`.trim();

export async function createAgentResponse(conversation: Array<Message>) {
  eventLogger.event('llm_init');
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...conversation,
    ],
    stream: true,
  });
  eventLogger.event('llm_request_sent');
  // eslint-disable-next-line functions/top-level-fn-decl
  const getAsyncIterator = async function* (): AsyncIterableIterator<string> {
    let hasStarted = false;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        if (!hasStarted) {
          eventLogger.event('llm_first_token_received');
          hasStarted = true;
        }
        yield content;
      }
    }
  };
  return getAsyncIterator();
}
