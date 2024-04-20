import type { Jsonifiable } from 'type-fest';

export type DataType = 'plain' | 'json' | 'utf-8';

export type EncodingType = 'cipher+aes-256-cbc' | 'base64' | 'base64url';

// export type EncodingSuffix<T extends EncodingType = EncodingType> =
//   | `${T}`
//   | `${T}/${Exclude<EncodingType, T>}`
//   | `${EncodingType}/${EncodingType}/${Exclude<EncodingType, T>}`;

// export type Encoding =
//   | DataType
//   | `${DataType}/${EncodingSuffix<Exclude<EncodingType, keyof DataType>>}`;

export type Encoding =
  | DataType
  | 'plain/base64'
  | 'plain/base64url'
  | 'plain/utf-8/cipher+aes-256-cbc/base64'
  | 'plain/utf-8/cipher+aes-256-cbc/base64url'
  | 'json/base64'
  | 'json/base64url'
  | 'json/utf-8/cipher+aes-256-cbc/base64'
  | 'json/utf-8/cipher+aes-256-cbc/base64url';

export type OyenMessage<T extends Jsonifiable = Jsonifiable> = {
  ch: string;
  d: T;
  enc: Encoding;
  iat: string;
};
