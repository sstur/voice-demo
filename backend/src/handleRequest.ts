import { createReadStream } from 'fs';
import { resolve } from 'path';

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
    case pathname === '/audio-player.html': {
      const path = resolve(__dirname, './assets/audioPlayer.html');
      const readStream = createReadStream(path, 'utf8');
      return new Response(readStream, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
  }
  return new Response('Not Found', { status: 404 });
}
