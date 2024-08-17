import {
  createEventSource,
  type EventSourceClient,
  type EventSourceMessage,
  type EventSourceOptions,
  type FetchLike,
  type ReadyState,
} from 'eventsource-client';
import type { Jsonifiable } from 'type-fest';
import {
  decodeBase64Encoding,
  decodeBase64UrlEncoding,
  decodeJson,
  decodePlain,
  decodeUtf8,
  type DecoderFunction,
} from './decoders.js';
import { EventSourceError, EventSourceParserError } from './error.js';
import type {
  DataType,
  DecodedEventMessage,
  EncodingType,
  EventMessage,
} from './types.js';
import { deferred, errToStr } from './utils.js';

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

  /**
   * Options to pass to 'eventsource-client'
   */
  eventSourceOptions?: Omit<
    EventSourceOptions,
    'url' | 'onConnect' | 'onDisconnect' | 'onMessage' | 'onScheduleReconnect'
  >;
}

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

function validateDecodedMessage<TMessageData extends Jsonifiable = Jsonifiable>(
  message: DecodedEventMessage<TMessageData> | unknown,
): message is DecodedEventMessage<TMessageData> {
  return (
    message !== null &&
    typeof message === 'object' &&
    'iat' in message &&
    'ch' in message &&
    'd' in message
  );
}

export class OyenEventSource<TMessageData extends Jsonifiable = Jsonifiable> {
  readonly #es: EventSourceClient;

  readonly #logger: ((...args: unknown[]) => void) | undefined;

  readonly #log = (msg: string, ...args: unknown[]) => {
    this.#logger?.(`${new Date().toISOString()} [eventsource] ${msg}`, ...args);
  };

  readonly #warn = (msg: string, ...args: unknown[]) => {
    this.#log(`!WARN! ${msg}`, ...args);
  };

  readonly #decoders: Partial<Record<EncodingType, DecoderFunction>>;

  #connectionMonitor = deferred();

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
    return this.#connectionMonitor.promise.then(() => {});
  }

  public addDecoder(
    encoding: EncodingType,
    decoder: DecoderFunction<TMessageData | any>,
  ) {
    this.#decoders[encoding] = decoder;
    return this;
  }

  constructor(params: OyenEventSourceOptions<TMessageData>) {
    const url = new URL(
      `/e/${params.teamId}/${params.eventSourceId}/event-stream`,
      params.endpoint || 'https://events.oyen.io/',
    );
    url.searchParams.set('accessToken', params.accessToken);

    params.channels.forEach((channel) => {
      url.searchParams.append('channels', channel);
    });

    this.#decoders = params.decoders || defaultDecoders;
    this.#logger = params.logger;

    this.#connectionMonitor = deferred();

    this.#es = createEventSource({
      ...params.eventSourceOptions,
      url: new URL(url),
      onConnect: () => {
        this.#connectionMonitor.resolve();
        this.#log('connected to %s', url);
      },
      onDisconnect: () => {
        this.#connectionMonitor = deferred();
        this.#log('disconnected from %s', url);
      },
      onMessage: () => {
        this.#connectionMonitor.resolve();
      },
      onScheduleReconnect: (info) => {
        this.#log('reconnect scheduled in %sms', info.delay);
      },
      // we wrap fetch so we can add logging
      fetch: (async (input, init) => {
        const fetchImpl = params.eventSourceOptions?.fetch || globalThis.fetch;
        this.#log('fetch: init %s %j', input, init);
        try {
          const res = await fetchImpl(input, init);
          this.#log('fetch: res %d', res.status);
          return res;
        } catch (err) {
          this.#warn('fetch: err %s', errToStr(err));
          throw err;
        }
      }) satisfies FetchLike,
    } satisfies EventSourceOptions);
  }

  public async *listen(eventName?: never) {
    this.#log('listening...' /* , eventName */);
    // eslint-disable-next-line no-restricted-syntax
    for await (const message of this.#es) {
      this.#log('message: %j', message);

      if (!eventName || message.event === eventName) {
        yield this.decode(message);
      } else {
        this.#log(
          'ignored message as it didnt match event %s %j',
          eventName,
          message,
        );
      }
    }
  }

  public async once(eventName?: never) {
    const listener = this.listen(eventName);
    const { value } = await listener.next();
    return value;
  }

  public async decode(message: EventSourceMessage) {
    const parsed = parseRawMessage<TMessageData>(String(message.data));
    this.#log('parsed: %j', parsed);

    const encodings = parsed.enc.split('/') as EncodingType[];

    const decoded = await encodings.reduceRight<Promise<unknown>>(
      async (data, encoding) => {
        const decoder =
          encoding in this.#decoders ? this.#decoders[encoding] : null;

        if (!decoder) {
          throw new EventSourceError(
            `No decoder registered for encoding ${JSON.stringify(encoding)}`,
          );
        }

        return decoder(await data, encoding);
      },
      Promise.resolve(parsed.d),
    );

    this.#log('decoded: %j', decoded);

    const maybeValidDecodedMessage = {
      ch: parsed.ch,
      d: decoded as unknown as TMessageData,
      iat: parsed.iat,
    };

    if (validateDecodedMessage<TMessageData>(maybeValidDecodedMessage)) {
      return maybeValidDecodedMessage;
    }

    this.#warn('invalid decoded message %j', maybeValidDecodedMessage);

    return null;
  }
}
