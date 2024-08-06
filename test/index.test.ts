/// <reference types="node" />
import { createToken } from '@oyen-oss/keys';
import { objectToBase64Url } from '@oyen-oss/keys/base64';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { createAesCbcDecoder } from '../lib/decoders.js';
import { createAesCbcEncoder } from '../lib/encoders.js';
import { EventTarget } from '../lib/event-target.js';
import { OyenEventStream } from '../src/main.js';
import { server } from './fake-server.js';

const keyPair = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign', 'verify'],
);

const jwk = objectToBase64Url({
  // gah, typescript
  ...(await crypto.subtle.exportKey('jwk', keyPair.privateKey)),
});

const listenPort = process.env.PORT || 3000;

describe('Basic', () => {
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

    const publishKey = await createToken({
      privateKey: jwk,

      ttlSecs: 3600,
      claims: {
        sub: teamId,
        scopes: {
          keys: ['list'],
          [`teams/${teamId}/events/${eventSourceId}/channels/*`]: ['publish'],
        },
      },
    });

    const endpoint = `http://localhost:${listenPort}/`;

    const eventSource = new OyenEventStream({
      teamId,
      eventSourceId,
      channels: ['sys'],
      accessToken: publishKey,
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

    const target = new EventTarget({
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
});
