/* eslint-disable no-console */
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
  source.once('message'),
]);

console.log('received:', received); //  { ch: 'test', secretMessage: '👋' }
