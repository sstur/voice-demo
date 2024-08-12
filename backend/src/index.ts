import './support/init';

import { createServer } from 'http';
import { Readable } from 'stream';

import { handleRequest } from './handleRequest';
import { HttpError } from './support/HttpError';
import { parseIncomingMessage } from './support/parseIncomingMessage';
import { wss } from './webSocketServer';

const PORT = 8000;

const server = createServer();

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.on('request', (req, res) => {
  const [url, request] = parseIncomingMessage(req);
  void handleRequest(url.pathname, request)
    .catch((error: unknown) => {
      if (error instanceof HttpError) {
        const { status, message } = error;
        return new Response(message, { status });
      }
      return new Response(String(error), { status: 500 });
    })
    .then((response) => {
      const { status, statusText, headers, body } = response;
      res.statusCode = status;
      res.statusMessage = statusText;
      for (const [name, value] of headers) {
        res.setHeader(name, value);
      }
      if (body) {
        Readable.fromWeb(body).pipe(res);
      } else {
        res.end();
      }
    });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Listening on http://localhost:${PORT}`);
});
