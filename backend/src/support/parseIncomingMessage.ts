import type { IncomingMessage } from 'http';
import { ReadableStream } from 'stream/web';

export function parseIncomingMessage(req: IncomingMessage) {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '', 'http://localhost/');
  const headers = new Headers(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    req.headersDistinct as Record<string, Array<string>>,
  );
  // Prevent "TypeError: Request with GET/HEAD method cannot have body."
  const canHaveBody = method !== 'GET' && method !== 'HEAD';
  const body = canHaveBody ? ReadableStream.from(req) : null;
  const request = new Request(url, {
    method,
    headers,
    body,
    duplex: 'half',
  });
  return [url, request] as const;
}
