import { IncomingMessage, ServerResponse, createServer } from 'node:http';
import type { EventMessage } from '../src/main.js';

function debug(msg: string | undefined, ...data: unknown[]) {
  // eslint-disable-next-line no-console
  console.debug(`[SRV] ${msg}`, ...data);
}

// Keep track of connected clients
const clients = new Set<ServerResponse<IncomingMessage>>();

// Function to send messages to connected clients
function sendToClients(message: EventMessage) {
  debug('sending %o to %d clients', message, clients.size);
  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify(message)}\n\n`);
  });
  // console.log(`sent to ${clients.size} clients`);
}

export const server = createServer((req, res) => {
  debug(req.method, req.url);
  if (req.headers.accept === 'text/event-stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    });

    // Add the response to the clients array
    debug('client connected');
    clients.add(res);

    res.write(
      `data: ${JSON.stringify({
        ch: 'sys',
        d: '👋',
        enc: 'plain',
        iat: new Date().toISOString(),
      } satisfies EventMessage)}\n\n`,
    );

    // Handle client disconnect
    req.on('close', () => {
      debug('client disconnected');
      clients.delete(res);
    });

    return;
  }

  if (req.url?.endsWith('/publish') && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      // Extract the message from the request body
      const message = JSON.parse(body);

      // Send the message to all connected clients
      sendToClients(message);

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Message published to clients.');
    });

    debug('published message');

    return;
  }

  debug('fall through ded');

  res.writeHead(500, { 'Content-Type': 'text/html' });
  res.end('<h1>ded</h1>');
});
