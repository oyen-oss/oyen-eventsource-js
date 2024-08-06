import {
  createEventSource,
  type EventSourceClient,
  type EventSourceMessage,
  type EventSourceOptions,
  type ReadyState,
} from 'eventsource-client';
import type { Jsonifiable, Simplify } from 'type-fest';
import {
  decodeBase64Encoding,
  decodeBase64UrlEncoding,
  decodeJson,
  decodePlain,
  decodeUtf8,
  type DecoderFunction,
} from './decoders.js';
import { EventSourceParserError } from './error.js';
import type { DataType, EncodingType, EventMessage } from './types.js';

export type { ReadyState } from 'eventsource-client';

export interface OyenEventSourceOptions<T> {
  teamId: string;
  eventSourceId: string;
  channels: string[];

  logger?: ((...args: unknown[]) => void) | undefined;

  decoders?: Partial<Record<EncodingType, DecoderFunction<T>>>;

  /**
   * JWT access token for oyen.io
   */
  accessToken: string;

  /**
   * Endpoint URL
   */
  endpoint?: string | URL;

  options?: Pick<EventSourceOptions, 'fetch'>;
}

export type DecodedEventMessage<T extends Jsonifiable> = Simplify<
  Omit<EventMessage<T>, 'enc'>
>;

function parseRawMessage<T extends Jsonifiable>(encoded: string) {
  try {
    return JSON.parse(encoded) as EventMessage<T>;
  } catch (err) {
    throw new EventSourceParserError(`Error parsing message: ${encoded}`, err);
  }
}

const defaultDecoders = {
  plain: decodePlain,
  json: decodeJson,
  'utf-8': decodeUtf8,
  base64: decodeBase64Encoding,
  base64url: decodeBase64UrlEncoding,
} satisfies Partial<Record<EncodingType | DataType, DecoderFunction>>;

function deferred<T extends void>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {};
  let reject: (err: Error) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

export class OyenEventSource<TMessageData extends Jsonifiable = Jsonifiable> {
  readonly #es: EventSourceClient;

  readonly #logger: ((...args: unknown[]) => void) | undefined;

  readonly #log = (msg: string, ...args: unknown[]) => {
    this.#logger?.(`[eventsource] ${msg}`, ...args);
  };

  readonly #decoders: Partial<Record<EncodingType, DecoderFunction>>;

  readonly #connectPromise: Promise<void>;

  public async once(event?: 'message') {
    const { value, done } = await this.listen(
      event === 'message' ? undefined : event,
    ).next();
    return done ? null : value;
  }

  public get readyState(): ReadyState {
    return this.#es.readyState;
  }

  public get url() {
    return this.#es.url;
  }

  public async close() {
    this.#es.close();
  }

  public get connected() {
    return this.#connectPromise.then(() => {});
  }

  public addDecoder(
    encoding: EncodingType,
    decoder: DecoderFunction<TMessageData | any>,
  ) {
    this.#decoders[encoding] = decoder;
    return this;
  }

  // eslint-disable-next-line class-methods-use-this
  #validateMessage(_: unknown): _ is TMessageData {
    return true;
  }

  constructor(params: OyenEventSourceOptions<TMessageData>) {
    if (params.logger) {
      this.#logger = params.logger;
    }

    const url = new URL(
      `/e/${params.teamId}/${params.eventSourceId}/event-stream`,
      params.endpoint || 'https://events.oyen.io/',
    );
    url.searchParams.set('accessToken', params.accessToken);

    params.channels.forEach((channel) => {
      url.searchParams.append('channels', channel);
    });

    this.#decoders = params.decoders || defaultDecoders;

    const connectPromise = deferred();

    this.#connectPromise = connectPromise.promise;

    this.#es = createEventSource({
      url: new URL(url),
      onConnect: () => {
        this.#log('connected');
        connectPromise.resolve();
      },
      onDisconnect: () => {
        this.#log('disconnected');
      },
      onMessage: (message) => {
        this.#log('got message', message);
      },
      onScheduleReconnect: (info) => {
        this.#log('reconnecting in %sms', info.delay);
      },
    });
  }

  public async *listen(event: undefined | 'message' | 'open' | 'error') {
    this.#log('listening for %s events...', event || 'ALL');
    // eslint-disable-next-line no-restricted-syntax
    for await (const message of this.#es) {
      this.#log('got message', message);

      if (!event || message.event === event) {
        yield this.decode(message);
        this.#log('yielded message', message);
      } else {
        this.#log('ignored message as it didnt match %s', event, message);
      }
    }
  }

  public async decode(message: EventSourceMessage) {
    const raw = parseRawMessage<TMessageData>(String(message.data));
    this.#log('saw raw', JSON.stringify(raw));

    const encodings = raw.enc.split('/') as EncodingType[];

    const decoded = await encodings.reduceRight<Promise<unknown>>(
      async (data, encoding) => {
        const decoder =
          encoding in this.#decoders ? this.#decoders[encoding] : null;

        if (!decoder) {
          throw new Error(
            `No decoder registered for encoding ${JSON.stringify(encoding)}`,
          );
        }

        return decoder(await data, encoding);
      },
      Promise.resolve(raw.d),
    );

    this.#log('decoded message as %j', decoded);

    if (this.#validateMessage(decoded)) {
      return {
        ch: raw.ch,
        d: decoded,
        iat: raw.iat,
      };
    }

    return null;
  }
}
