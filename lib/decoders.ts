import type { JsonObject } from 'type-fest';
import { base64ToUint8Array } from 'uint8array-extras';
import { EventSourceDecoderError } from './error.js';
import type { EncodingType } from './types.js';

type TAllowableMessageDecoding = unknown;

function withNullProto<T extends JsonObject>(obj: T): T {
  return Object.assign(Object.create(null), obj);
}

export function assertStringEncoding(
  data: TAllowableMessageDecoding,
  encoding: EncodingType,
): asserts data is string {
  if (typeof data !== 'string') {
    throw new EventSourceDecoderError(
      `Expected string data for ${JSON.stringify(
        encoding,
      )} encoding, got ${typeof data}.`,
    ).debug({ data });
  }
}

export function assertArrayBufferEncoding(
  data: TAllowableMessageDecoding,
  encoding: EncodingType,
): asserts data is ArrayBuffer {
  if (!(data instanceof ArrayBuffer) && !(data instanceof Uint8Array)) {
    throw new EventSourceDecoderError(
      `Expected ArrayBuffer/Uint8Array data for ${JSON.stringify(
        encoding,
      )} encoding, got ${typeof data}.`,
    ).debug({ data });
  }
}

export type DecoderFunction<
  T extends TAllowableMessageDecoding = TAllowableMessageDecoding,
> = (data: TAllowableMessageDecoding, encoding: EncodingType) => T | Promise<T>;

export function decodePlain(
  data: TAllowableMessageDecoding,
  encoding: EncodingType,
) {
  assertStringEncoding(data, encoding);
  return data;
}

export function decodeJson(
  data: TAllowableMessageDecoding,
  encoding: EncodingType,
) {
  assertStringEncoding(data, encoding);
  const parsed = JSON.parse(data);
  return typeof parsed === 'object' ? withNullProto(parsed) : parsed;
}

export function decodeUtf8(
  data: TAllowableMessageDecoding,
  encoding: EncodingType,
) {
  assertArrayBufferEncoding(data, encoding);
  return new TextDecoder().decode(data);
}

export function decodeBase64Encoding(
  data: TAllowableMessageDecoding,
  encoding: EncodingType,
) {
  assertStringEncoding(data, encoding);
  return base64ToUint8Array(data);
}

export function decodeBase64UrlEncoding(
  data: TAllowableMessageDecoding,
  encoding: EncodingType,
) {
  assertStringEncoding(data, encoding);
  return base64ToUint8Array(data);
}

export function createAesCbcDecoder(keyBytes: ArrayBuffer) {
  return async (data: TAllowableMessageDecoding, encoding: EncodingType) => {
    assertArrayBufferEncoding(data, encoding);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      'AES-CBC',
      false,
      ['decrypt'],
    );

    return crypto.subtle.decrypt(
      {
        name: 'AES-CBC',
        iv: data.slice(0, 16),
      },
      cryptoKey,
      data.slice(16),
    );
  };
}
