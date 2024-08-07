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
      const readStream = createReadStream(path);
      return new Response(readStream, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    case pathname === '/audio.pcm': {
      const path = resolve(__dirname, './assets/audio.pcm');
      const readStream = createReadStream(path);
      return new Response(getAsyncIterator(readStream), {
        headers: { 'content-type': 'text/plain' },
      });
    }
  }
  return new Response('Not Found', { status: 404 });
}

async function* getAsyncIterator(
  readStream: AsyncIterable<Buffer>,
): AsyncIterable<Uint8Array> {
  for await (const chunk of readStream) {
    const encoded = chunk.toString('base64');
    yield Buffer.from(encoded, 'ascii');
  }
}
