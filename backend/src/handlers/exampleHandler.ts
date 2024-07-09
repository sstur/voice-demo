export async function exampleHandler(request: Request): Promise<Response> {
  // TODO: Remove this
  await Promise.resolve(request);
  return Response.json({ hello: 'world' });
}
