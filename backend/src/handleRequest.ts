import { exampleHandler } from './handlers/exampleHandler';

export async function handleRequest(
  pathname: string,
  request: Request,
): Promise<Response> {
  switch (true) {
    case pathname === '/': {
      return new Response('Hello World!');
    }
    case pathname === '/example': {
      return await exampleHandler(request);
    }
  }
  return new Response('Not Found', { status: 404 });
}
