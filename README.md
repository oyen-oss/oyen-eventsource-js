# @oyenjs/eventsource

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## Description

Eventsource library with support for automatic encryption and decryption of
messages for naive end-to-end encryption with an oob pre-shared key

Currently under active development.

## Example

```typescript
import {
  createAesCbcDecoder,
  createAesCbcEncoder,
  OyenEventSource,
  OyenEventTarget,
} from '@oyenjs/eventsource';

const teamId = 'example';
const eventSourceId = 'abcd12345';
const accessToken = 'e30.e30....';

const channel = 'test';

const myTopSecretKey = crypto.getRandomValues(new Uint8Array(32));

const source = new OyenEventSource({
  teamId,
  eventSourceId,
  channels: [channel],
  accessToken,
}).addDecoder('cipher+aes-256-cbc', createAesCbcDecoder(myTopSecretKey));

const target = new OyenEventTarget({
  teamId,
  eventSourceId,
}).addEncoder('cipher+aes-256-cbc', createAesCbcEncoder(myTopSecretKey));

const secretMessage = '👋';

const [, received] = await Promise.all([
  target.publish({
    ch: channel,
    d: {
      secretMessage,
    },
    enc: 'json',
  }),
  source.once(),
]);

console.log('received:', received); //  { ch: 'test', secretMessage: '👋' }
```

## License

Licensed under the terms of the MIT license. See the [LICENSE](LICENSE.md) file for more details.
