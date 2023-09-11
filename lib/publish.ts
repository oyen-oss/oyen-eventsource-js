import type { Jsonifiable } from 'type-fest';
import {
  encodeBase64Encoding,
  encodeBase64UrlEncoding,
  encodeJson,
  encodePlain,
  encodeUtf8,
  type EncoderFunction,
} from './encoders.js';
import type { DataType, EncodingType, OyenMessage } from './types.js';

const defaultEncoders: Partial<
  Record<DataType | EncodingType, EncoderFunction>
> = {
  plain: encodePlain,
  base64: encodeBase64Encoding,
  base64url: encodeBase64UrlEncoding,
  'utf-8': encodeUtf8,
  json: encodeJson,
};

export class EventTarget {
  #endpoint: URL;

  #encoders: Partial<Record<DataType | EncodingType, EncoderFunction>>;

  #fetchImpl: (
    input: URL | RequestInfo,
    init?: RequestInit | undefined,
  ) => Promise<Response>;

  public addEncoder(
    encoding: DataType | EncodingType,
    encoder: EncoderFunction,
  ): void {
    this.#encoders[encoding] = encoder;
  }

  // eslint-disable-next-line class-methods-use-this
  #debug = (..._data: unknown[]) => {
    // eslint-disable-next-line no-console
    // console.debug('ET', ..._data);
  };

  constructor(params: {
    endpoint: URL | string;
    encoders?: Partial<Record<DataType | EncodingType, EncoderFunction>>;
    fetchImpl?: typeof fetch;
  }) {
    this.#endpoint = new URL(params.endpoint);
    this.#encoders = params.encoders || defaultEncoders;
    this.#fetchImpl = params.fetchImpl || globalThis.fetch.bind(globalThis);
  }

  public async publish<T extends Jsonifiable>(
    message: Omit<OyenMessage<T>, 'iat'>,
  ): Promise<void> {
    const encodings = message.enc.split('/') as (DataType | EncodingType)[];

    const encoded = await encodings.reduce<Promise<unknown>>(
      async (data, encoding) => {
        this.#debug({ data: await data, encoding });

        const encoder = this.#encoders[encoding];

        if (!encoder) {
          throw new Error(
            `No encoder registered for encoding ${JSON.stringify(encoding)}`,
          );
        }

        return encoder(await data, encoding);
      },
      Promise.resolve(message.d),
    );

    this.#debug({ encoded });

    const res = await this.#fetchImpl(
      new URL(this.#endpoint || 'https://events.oyen.io'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          iat: new Date().toISOString(),
          ...message,
          // TODO: dont cast the type!
          d: encoded as T,
        } satisfies OyenMessage<T>),
      },
    );

    this.#debug({ status: res.status });
  }
}
