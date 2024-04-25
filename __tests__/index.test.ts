import { createApiKey } from '@oyen-oss/keys';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { createAesCbcDecoder } from '../lib/decoders.js';
import { createAesCbcEncoder } from '../lib/encoders.js';
import { EventTarget } from '../lib/event-target.js';
import { OyenEventSource } from '../src/main.js';
import { EventSource } from '../src/polyfill.js';
import { server } from './fake-server.js';

// fake for testing only
const privateKey =
  'eyJhbGciOiJSUzI1NiIsImt0eSI6IlJTQSIsImUiOiJBUUFCIiwiZCI6IlRqQXlFN3MxRVZWb0NRLUt5dnJQcVgwRUp3amVsUEtpdEFlcDRac0kwNHVaUkNuNVM4WmYteVBWWmFuc1BhOThRaHhCNFAxem9rMnVQdm11aExFd2FqWFg3Ni1SVk9UNldmVlBZNmttM0Zxd3Z1SGszeGJubE9Vdko0ZmJTUTRwbXdncDE0RVhKOEEtbjh6V3lNdXl2UDdTU1JiZG1ncU9oa3BZNU1lY1dRQmdVNXI0TEFzel9ld2dhV2pDby1STjJST0haNWt4MjJBMUpiQmJqMS1RWFAxME5XVTUyR25UdG5tdTBvRGlpYWEwZlpnT3VPTThUYUNJTlpLU3M2aENfTEdLejd3NVJPRWFsbVhCcWtWcWYyaFZiUVV4SzlQTW1pOGJzS2pmNjNfTDBnR25JaTRTWkFzampZVlV2SDhjRHE4cURTVWlham1oZW10dm5QU2dYUSIsIm4iOiJzNFJkQUpBbDdHaC1xQndmcm1iR2R6QVhFVHVyREpiVURBNlFZR2F4VWdyd21EU3RCR01aWmhjNVlWQ29MRVFOVjJnY05ULW93TENseDEwVEZXLThBNFNZYkhFc1RjYjJmUWF5dElOTmhmcnN2SVhLQnhlUHlQREpGRUZla1NyYVN6djVzMy1kRVV5YmZ0VGZHSkItMnlQanlOR0c5ZjlDdk1SUDVxMTREWUJ0eGFRVWxVeDJmNmZDb2xkLUU4aC1RbXZhLUFOZlU2TzdUd0lvWWo5UzdxS2I2eVEwZnNKS3pyemVCbV9haFVkdXg2VThkRzNxWlJGRnc4YnJXMENya3RwenZrMThtR2NBeHo3aVBua0JDZlFXd0VfcFAzakF2ck9TREpvMDhpTzE3ZWsySXprazRzX1NTYnEwTkFkRU9XYUROdVF5NzUyOFVULUZHVjFGM3ciLCJwIjoiX0Z2aEV3ZURjSUZVTU5tWUt6X2FNQjB0S2NXeXdmamY1blRwRmotVC1acXFKQll3WXgtZUktTTE2Z0hnSnFwRUNCYWh0cU56UTAzeVFCZkRQbndYZWxRV2xRb3Y2aXd1cFhZNERtU2wxZkw1ckh0ckNjVXhkd1hxYXFwZEVsQ2NNcUNsdWZpTlVZU3B4ZjhiX1FHeFJ1TlRiaVhiT19PU1hKWDdCS1c3QU5zIiwicSI6InRodHU0QUMwSVk2UGZtRnZDSFNoOGhsTjg4RTR5U191V2NZNVN0R0dzVmdMUEw2YWhwbTBJN0JNNlVOU0dqVXBlSkFhaFB5N2FoZTF5SWRRRzBEZEVrSnpiV2NTVzF3b3BoVC1SV1ZPVnJFRWNYNllrNTBEZUJ0WHVmbWw3QVh3TGt2TlQ1cWI3YTRmNFo5bE1fNkRXTmtCNmlDVzBYbXFSbkhMVjVlblRFMCIsImRwIjoiSFVtMGgzYlp4RmJlSklVOGFkaVJSQUEtMjVnOE5OTGplV1djSDU3bFY1U2hwbXFFMXh3MlNFZjRXOTQzMjRUclBGMFVDNVJRcmtEX21ueW5oanIwcHBmWHZ4aGRrem5wZF82T1p1MDdhZWMzSHROOENyZy1FMmcyV29iSEluY0VpY09uT0R3bWVvMkFfcC1xNmVRbVpPbkJKd2x4dGpXQWlRcEhCYlVPVFAwIiwiZHEiOiJxN2UybDFkU2hBb1AyUlk3UXZmbjlZaFM3elVXUFBBTGkyX1ZlbTJVMndtd252a0VjVVBpajN5aEtad25nVHI3X2dtMFdBNlJFdnVFbUxDdm91TkpFdnpDSnpsNEg5b0pJb0xOT2RiTFJnZnByck8zWUFwQXlUTFBTRGpXY25jdkFoak1ZdkhoY3dBc1ktNlAyYlYzV1lKWHdkUTFJeFhjc0V5QmRfa3k4a2siLCJxaSI6Im92c2VhbnVVZFhwa19ZS1RLM2JRWDZDQjQ3ZUNxSkoyTVp5UFpJVXpkVkFhVnYtaWk3QllETFFFYlI2V1c3b0hjX3EyQUhNckVGSDFqcENZb2lfLURsTXhRR0t2NXpmTFBmLU9Kb0ZtaURGLWRFZ0tWbzZHbVgyQjdRNDR0ckFyNng0MHhsVXEzRmQ3SGx5NTZzVllNQnNnVl9Yd0JCTjRsX05JLW5KWkVwSSIsImtpZCI6IkNZUm03ak1WV05rd3QyV2dmV21EdFQzZCJ9';

const listenPort = process.env.PORT || 3000;

describe('Basic', () => {
  beforeAll(
    async () =>
      new Promise<void>((resolve) => {
        server.listen(listenPort, resolve);
      }),
  );
  afterAll(() => server.close());

  // fake for testing only
  const teamId = 'z7t7j3d8cTD';
  // fake for testing only
  const eventSourceId = 'K7pWQnDx8z2Y';

  test('Nothing', async () => {
    const errorFn = vi.fn(async () => {});
    const openFn = vi.fn(async () => {});
    const messageFn = vi.fn(async () => {});

    const publishKey = await createApiKey({
      privateKey,
      teamId,
      ttlSecs: 3600,
      claims: {
        sub: teamId,
        scopes: {
          keys: ['list'],
          [`events/${eventSourceId}/channels/*`]: ['publish'],
        },
      },
    });

    const endpoint = `http://localhost:${listenPort}/`;

    const eventSource = new OyenEventSource({
      teamId,
      eventSourceId,
      channels: ['test'],
      accessToken: publishKey,
      endpoint,
      eventSourceClass: EventSource,
      // logger: console.log,
      timeoutSecs: 1000, // short for tests
      // reconnectIntervalSecs: Infinity,
      // eventSourceInit: {
      //   withCredentials: false,
      // },
      // decoders: {},
    });

    const randomEncryptionKey = crypto.getRandomValues(new Uint8Array(32));

    eventSource.addDecoder(
      'cipher+aes-256-cbc',
      createAesCbcDecoder(randomEncryptionKey),
    );

    eventSource.on('open', openFn);
    eventSource.on('error', errorFn);
    eventSource.on('message', messageFn);

    await eventSource.once('open');
    expect(openFn).toHaveBeenCalledTimes(1);

    // wait for helo
    await eventSource.once('message');
    expect(messageFn).toHaveBeenCalledTimes(1);

    const target = new EventTarget({
      endpoint,
      fetchImpl: fetch,
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

    expect(messageFn).toHaveBeenCalledTimes(2);

    // /////////////////////////////////

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

    expect(messageFn).toHaveBeenCalledTimes(3);

    // /////////////////////////////

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

    expect(messageFn).toHaveBeenCalledTimes(4);

    // /////////////////////////////

    expect(errorFn).not.toHaveBeenCalled();

    eventSource.close();
  });
});
