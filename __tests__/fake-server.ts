import { IncomingMessage, ServerResponse, createServer } from 'node:http';
import { type OyenMessage } from '../src/main.js';

// Keep track of connected clients
const clients = new Set<ServerResponse<IncomingMessage>>();

// Function to send messages to connected clients
function sendToClients(message: OyenMessage) {
  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify(message)}\n\n`);
  });
  // console.log(`sent to ${clients.size} clients`);
}

export const server = createServer((req, res) => {
  // console.log(req.method, req.url);
  if (req.headers.accept === 'text/event-stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Add the response to the clients array
    clients.add(res);

    res.write(
      `data: ${JSON.stringify({
        ch: 'sys',
        d: '👋',
        enc: 'plain',
        iat: new Date().toISOString(),
      } satisfies OyenMessage)}\n\n`,
    );

    // Handle client disconnect
    req.on('close', () => {
      clients.delete(res);
    });

    return;
  }

  if (req.url === '/publish' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      // Extract the message from the request body
      const message = JSON.parse(body) as OyenMessage;

      // Send the message to all connected clients
      sendToClients(message);

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Message published to clients.');
    });

    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>ded</h1>');
});
