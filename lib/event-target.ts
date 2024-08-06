import type { Jsonifiable } from 'type-fest';
import {
  encodeBase64Encoding,
  encodeBase64UrlEncoding,
  encodeJson,
  encodePlain,
  encodeUtf8,
  type EncoderFunction,
} from './encoders.js';
import { EventTargetError } from './error.js';
import type { DataType, EncodingType, EventMessage } from './types.js';

const defaultEncoders: Partial<
  Record<DataType | EncodingType, EncoderFunction>
> = {
  plain: encodePlain,
  base64: encodeBase64Encoding,
  base64url: encodeBase64UrlEncoding,
  'utf-8': encodeUtf8,
  json: encodeJson,
};

export class OyenEventTarget<T extends Jsonifiable, C extends string = string> {
  #endpoint: URL;

  #encoders: Partial<Record<DataType | EncodingType, EncoderFunction>>;

  #teamId: string;

  #eventSourceId: string;

  #init: Omit<RequestInit, 'body' | 'method'>;

  #logger?: { debug?: (...args: unknown[]) => void };

  public addEncoder(
    encoding: DataType | EncodingType,
    encoder: EncoderFunction,
  ) {
    this.#encoders[encoding] = encoder;
    return this;
  }

  constructor(params: {
    teamId: string;
    eventSourceId: string;
    endpoint?: URL | string;
    encoders?: Partial<Record<DataType | EncodingType, EncoderFunction>>;
    init?: RequestInit;
    logger?: {
      debug?: (...args: unknown[]) => void;
    };
  }) {
    this.#teamId = params.teamId;
    this.#eventSourceId = params.eventSourceId;

    this.#endpoint = new URL(params.endpoint || 'https://events.oyen.io');
    this.#encoders = params.encoders || defaultEncoders;

    this.#init = params.init || {};

    if (params.logger) {
      this.#logger = params.logger;
    }
  }

  public async publish(
    message: Omit<EventMessage<T, C>, 'iat'>,
  ): Promise<void> {
    const encodings = message.enc.split('/') as (DataType | EncodingType)[];

    const maybeEncoded = await encodings.reduce<Promise<unknown>>(
      async (promise, encoding) => {
        const encoder = this.#encoders[encoding];

        if (!encoder) {
          throw new Error(
            `No encoder registered for encoding ${JSON.stringify(encoding)}`,
          );
        }

        return promise.then((data) => encoder(data, encoding));
      },
      Promise.resolve(message.d),
    );

    const headers = new Headers(this.#init.headers);
    headers.set('content-type', 'application/json; charset=utf-8');

    const init = {
      ...this.#init,
      method: 'post',
      headers, // already inherits from this.#init.headers ^^
      body: JSON.stringify({
        iat: new Date().toISOString(),
        ...message,
        // TODO: dont cast the type!
        d: maybeEncoded as T,
      } satisfies EventMessage<T>),
    };

    const url = new URL(
      `/e/${this.#teamId}/${this.#eventSourceId}/publish`,
      this.#endpoint,
    );

    this.#logger?.debug?.({ url, ...init }, 'request');

    const res = await fetch(url, init);

    this.#logger?.debug?.(
      {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        url: res.url,
      },
      'response',
    );

    if (!res.ok) {
      throw new EventTargetError('Failed to publish message').debug({
        url: url.toString(),
        init,
      });
    }
  }
}
