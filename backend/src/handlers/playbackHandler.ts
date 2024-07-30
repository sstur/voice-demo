import {
  OUTPUT_FILE_NAME,
  OUTPUT_FORMAT_CONTENT_TYPE,
} from '../VoiceController';
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
      'Content-Type': OUTPUT_FORMAT_CONTENT_TYPE,
      'Content-Disposition': `inline; filename="${OUTPUT_FILE_NAME}"`,
    },
  });
}
