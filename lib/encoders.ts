import { encodeBase64, encodeBase64Url } from '@oyen-oss/keys/base64';
import type { Jsonifiable } from 'type-fest';
import { EventSourceEncoderError } from './error.js';
import type { DataType, EncodingType } from './types.js';

export function assertStringEncoding(
  data: Jsonifiable | ArrayBuffer | unknown,
  encoding: DataType | EncodingType,
): asserts data is string {
  if (typeof data !== 'string') {
    throw new EventSourceEncoderError(
      `Expected string data for ${JSON.stringify(
        encoding,
      )} encoding, got ${typeof data}.`,
    );
  }
}

function isJsonifiable(data: unknown): data is Jsonifiable {
  return (
    typeof data === 'string' ||
    typeof data === 'number' ||
    typeof data === 'boolean' ||
    (typeof data === 'object' && data !== null && 'toJSON' in data) ||
    (Array.isArray(data) && data.every(isJsonifiable)) ||
    (typeof data === 'object' &&
      data !== null &&
      Object.values(data).every(isJsonifiable))
  );
}

export function assertJsonifiableEncoding(
  data: Jsonifiable | ArrayBuffer | unknown,
  encoding: DataType | EncodingType,
): asserts data is Jsonifiable {
  if (!isJsonifiable(data)) {
    throw new EventSourceEncoderError(
      `Expected JSONifiable data for ${JSON.stringify(
        encoding,
      )} encoding, got ${typeof data}.`,
    );
  }
}
export function assertArrayBufferEncoding(
  data: Jsonifiable | ArrayBuffer | unknown,
  encoding: DataType | EncodingType,
): asserts data is ArrayBuffer {
  if (!(data instanceof ArrayBuffer) && !(data instanceof Uint8Array)) {
    throw new EventSourceEncoderError(
      `Expected ArrayBuffer/Uint8Array data for ${JSON.stringify(
        encoding,
      )} encoding, got ${typeof data}.`,
    );
  }
}

export type EncoderFunction<
  T extends Jsonifiable | ArrayBuffer | unknown =
    | Jsonifiable
    | ArrayBuffer
    | unknown,
> = (data: T, encoding: DataType | EncodingType) => T | Promise<T>;

export const encodePlain: EncoderFunction = ((data, encoding) => {
  assertStringEncoding(data, encoding);
  return data;
}) satisfies EncoderFunction;

export const encodeJson: EncoderFunction = ((data, encoding) => {
  assertJsonifiableEncoding(data, encoding);
  return JSON.stringify(data);
}) satisfies EncoderFunction;

export const encodeUtf8: EncoderFunction = ((data, encoding) => {
  assertStringEncoding(data, encoding);
  return new TextEncoder().encode(data);
}) satisfies EncoderFunction;

export const encodeBase64Encoding: EncoderFunction = ((data, encoding) => {
  assertArrayBufferEncoding(data, encoding);
  return encodeBase64(data);
}) satisfies EncoderFunction;

export const encodeBase64UrlEncoding: EncoderFunction = ((data, encoding) => {
  assertArrayBufferEncoding(data, encoding);
  return encodeBase64Url(data);
}) satisfies EncoderFunction;

export function createAesCbcEncoder(keyBytes: ArrayBuffer): EncoderFunction {
  return async (data, encoding) => {
    assertArrayBufferEncoding(data, encoding);

    const importedKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      'AES-CBC',
      false,
      ['encrypt'],
    );

    const iv = crypto.getRandomValues(new Uint8Array(16));
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-CBC',
        iv,
        // length: 256,
      },
      importedKey,
      data,
    );

    const cipherText = new Uint8Array(encryptedData);
    const result = new Uint8Array(iv.length + cipherText.length);
    result.set(iv, 0);
    result.set(cipherText, iv.length);

    return result;
  };
}
