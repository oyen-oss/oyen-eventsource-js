import type { Jsonifiable } from 'type-fest';
import {
  encodeBase64Encoding,
  encodeBase64UrlEncoding,
  encodeJson,
  encodePlain,
  encodeUtf8,
  type EncoderFunction,
} from './encoders.js';
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

export class EventTarget {
  #endpoint: URL;

  #encoders: Partial<Record<DataType | EncodingType, EncoderFunction>>;

  #fetchImpl: (
    input: URL | RequestInfo,
    init?: RequestInit | undefined,
  ) => Promise<Response>;

  #teamId: string;

  #eventSourceId: string;

  public addEncoder(
    encoding: DataType | EncodingType,
    encoder: EncoderFunction,
  ): void {
    this.#encoders[encoding] = encoder;
  }

  // eslint-disable-next-line class-methods-use-this
  #debug = (...data: unknown[]) => {
    // eslint-disable-next-line no-console
    console.debug('[EVT]', ...data);
  };

  constructor(params: {
    teamId: string;
    eventSourceId: string;
    endpoint?: URL | string;
    encoders?: Partial<Record<DataType | EncodingType, EncoderFunction>>;
    fetchImpl?: typeof fetch;
  }) {
    this.#teamId = params.teamId;
    this.#eventSourceId = params.eventSourceId;

    this.#endpoint = new URL(params.endpoint || 'https://events.oyen.io');
    this.#encoders = params.encoders || defaultEncoders;
    this.#fetchImpl = params.fetchImpl || globalThis.fetch.bind(globalThis);
  }

  public async publish<T extends Jsonifiable>(
    message: Omit<EventMessage<T>, 'iat'>,
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
      new URL(
        `/e/${this.#teamId}/${this.#eventSourceId}/publish`,
        this.#endpoint,
      ),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },

        keepalive: true,
        body: JSON.stringify({
          iat: new Date().toISOString(),
          ...message,
          // TODO: dont cast the type!
          d: encoded as T,
        } satisfies EventMessage<T>),
      },
    );

    if (!res.ok) {
      throw new Error('Failed to publish message');
    }
  }
}
