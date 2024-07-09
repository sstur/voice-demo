import { createServer } from 'http';

const PORT = 8000;

const server = createServer();

server.on('request', (request, response) => {
  response.end('Hello world!');
});

server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
