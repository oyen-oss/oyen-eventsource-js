import type { Jsonifiable } from 'type-fest';

export type DataType = 'plain' | 'json' | 'utf-8';

export type EncodingType = 'cipher+aes-256-cbc' | 'base64' | 'base64url';

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

export type EventMessage<
  T extends Jsonifiable = Jsonifiable,
  C extends string = string,
> = {
  ch: C;
  d: T;
  enc: Encoding;
  iat: string;
};

export type DecodedEventMessage<T extends Jsonifiable> = Omit<
  EventMessage<T>,
  'enc'
>;
