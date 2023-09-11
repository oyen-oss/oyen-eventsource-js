import type { Jsonifiable } from 'type-fest';

export type DataType = 'plain' | 'json' | 'bytes' | 'utf-8';

export type EncodingType = 'cipher+aes-256-cbc' | 'base64' | 'base64url';

export type EncodingSuffix<T extends EncodingType = EncodingType> =
  | `${T}`
  | `${T}/${Exclude<EncodingType, T>}`
  | `${EncodingType}/${EncodingType}/${Exclude<EncodingType, T>}`;

export type Encoding =
  | DataType
  | `${DataType}/${EncodingSuffix<Exclude<EncodingType, keyof DataType>>}`;

export type OyenMessage<T extends Jsonifiable = Jsonifiable> = {
  ch: string;
  d: T;
  enc: Encoding;
  iat: string;
};
