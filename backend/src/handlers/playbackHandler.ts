import { voiceResponseStore } from '../voiceResponseStore';

// eslint-disable-next-line @typescript-eslint/require-await
export async function playbackHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const contextId = url.pathname.slice(1).split('/')[1] ?? '';
  const asyncQueue = voiceResponseStore.get(contextId);
  if (!asyncQueue) {
    return new Response('Not Found', { status: 404 });
  }
  return new Response(asyncQueue, {
    headers: {
      'content-type': 'audio/wav',
    },
  });
}
