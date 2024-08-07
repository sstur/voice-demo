import { playbackHandler } from './handlers/playbackHandler';

export async function handleRequest(
  pathname: string,
  request: Request,
): Promise<Response> {
  switch (true) {
    case pathname === '/': {
      return new Response('Hello World!');
    }
    case pathname.startsWith('/playback/'): {
      return await playbackHandler(request);
    }
  }
  return new Response('Not Found', { status: 404 });
}
