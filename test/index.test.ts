import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { createAesCbcDecoder } from '../lib/decoders.js';
import { createAesCbcEncoder } from '../lib/encoders.js';
import { OyenEventTarget } from '../lib/event-target.js';
import { OyenEventSource } from '../src/main.js';
import { server } from './fake-server.js';

const listenPort = process.env.PORT || 3000;

beforeAll(
  async () =>
    new Promise<void>((resolve) => {
      server.listen(listenPort, resolve);
    }),
);

afterAll(() => server.close());

const teamId = 'tttttt';
const eventSourceId = 'eeeeee';

test('Nothing', async () => {
  const errorFn = vi.fn(async () => {});

  const accessToken = 'e30.e30.';
  const endpoint = `http://localhost:${listenPort}/`;

  const eventSource = new OyenEventSource({
    teamId,
    eventSourceId,
    channels: ['sys'],
    accessToken,
    endpoint,
  });

  const randomEncryptionKey = crypto.getRandomValues(new Uint8Array(32));

  eventSource.addDecoder(
    'cipher+aes-256-cbc',
    createAesCbcDecoder(randomEncryptionKey),
  );

  // wait for helo
  const message = await eventSource.once('message');
  expect(message).toMatchObject({
    ch: 'sys',
    d: '👋',
  });

  const target = new OyenEventTarget({
    endpoint,
    teamId,
    eventSourceId,
  });

  await Promise.all([
    target.publish({
      ch: 'test',
      d: {
        greet: 'oyen!!!',
      },
      enc: 'json',
    }),
    eventSource.once('message'),
  ]);

  await Promise.all([
    target.publish({
      ch: 'test',
      d: `{
          greet: 'oyen!!!',
        }`,
      enc: 'json',
    }),

    eventSource.once('message'),
  ]);

  target.addEncoder(
    'cipher+aes-256-cbc',
    createAesCbcEncoder(randomEncryptionKey),
  );

  await Promise.all([
    target.publish({
      ch: 'test',
      d: {
        greet: 'oyen!!!',
      },
      enc: 'json/utf-8/cipher+aes-256-cbc/base64',
    }),

    eventSource.once('message'),
  ]);

  expect(errorFn).not.toHaveBeenCalled();

  eventSource.close();
});
