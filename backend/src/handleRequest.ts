// eslint-disable-next-line @typescript-eslint/require-await
export async function handleRequest(
  pathname: string,
  _request: Request,
): Promise<Response> {
  switch (true) {
    case pathname === '/': {
      return new Response('Hello World!');
    }
  }
  return new Response('Not Found', { status: 404 });
}
