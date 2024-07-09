export async function uploadHandler(request: Request): Promise<Response> {
  await Promise.resolve(request.url);
  return new Response('Upload successful!');
}
