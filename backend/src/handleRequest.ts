import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';
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
      const readStream = createReadStream(path);
      return new Response(readStream, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    case pathname === '/audio.pcm': {
      const path = resolve(__dirname, './assets/audio.pcm');
      const data = await readFile(path);
      const encoded = data.toString('base64');
      return new Response(encoded, {
        headers: { 'content-type': 'text/plain' },
      });
    }
  }
  return new Response('Not Found', { status: 404 });
}
