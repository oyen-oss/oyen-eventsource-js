import { Status } from '@block65/custom-error';
import Emittery from 'emittery';
import _ReconnectingEventSourceBroken from 'reconnecting-eventsource';
import type { Class, Jsonifiable, Simplify } from 'type-fest';
import type { EventSource as EventSourcePolyfill } from '../src/polyfill.js';
import {
  decodeBase64Encoding,
  decodeBase64UrlEncoding,
  decodeJson,
  decodePlain,
  decodeUtf8,
  type DecoderFunction,
} from './decoders.js';
import {
  EventSourceError,
  EventSourceParserError,
  EventSourceTimeoutError,
} from './error.js';
import type { DataType, EncodingType, EventMessage } from './types.js';

// busted types?
type ReconnectingEventSourceType = _ReconnectingEventSourceBroken.default;
const ReconnectingEventSource =
  _ReconnectingEventSourceBroken as unknown as typeof _ReconnectingEventSourceBroken.default;

// create a new EventSource interface but dont allow the url to be a URL, only string
// this is because the eventsource polyfill doesnt support URL
export interface EventSourceWithoutUrl extends EventSource {
  constructor(url: string, eventSourceInitDict?: EventSourceInit): void;
}

interface OyenEventSourceOptions<T> {
  teamId: string;
  eventSourceId: string;
  channels: string[];

  logger?: (...args: unknown[]) => void;

  decoders?: Partial<Record<EncodingType, DecoderFunction<T>>>;

  /**
   * JWT access token
   */
  accessToken: string;

  /**
   * Timeout for initial connection in seconds
   */
  timeoutSecs?: number;

  /**
   * Endpoint URL
   */
  endpoint?: string | URL;

  /**
   * Reconnect interval in seconds
   * @default 5
   *
   */
  reconnectIntervalSecs?: number;

  /**
   * If you want to receive events that happened before you connected, pass the
   * lastEventId
   *
   */
  lastEventId?: number;

  /**
   * EventSource class
   */
  eventSourceClass?: Class<EventSourcePolyfill> | Class<EventSource>;

  /**
   * EventSource options
   */
  eventSourceInit?: EventSourceInit;
}

export const enum ReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSED = 2,
}

function parseRawMessage(encoded: string) {
  try {
    return JSON.parse(encoded) as EventMessage<Jsonifiable>;
  } catch (err) {
    throw new EventSourceParserError(`Error parsing message: ${encoded}`, err);
  }
}

export const defaultDecoders = {
  plain: decodePlain,
  json: decodeJson,
  'utf-8': decodeUtf8,
  base64: decodeBase64Encoding,
  base64url: decodeBase64UrlEncoding,
} satisfies Partial<Record<EncodingType | DataType, DecoderFunction>>;

export type DecodedEventMessage<T extends Jsonifiable> = Simplify<
  Omit<EventMessage<T>, 'encoding'>
>;

export class OyenEventStream<TMessageData extends Jsonifiable = Jsonifiable> {
  #es: ReconnectingEventSourceType;

  #logger?: (...args: unknown[]) => void;

  #emitter = new Emittery<{
    open: undefined;
    message: DecodedEventMessage<TMessageData>;
    error: EventSourceError;
    exception: DecodedEventMessage<{
      statusCode: Status;
      message?: string;
    }>;
  }>();

  #log = (msg: string, ...data: unknown[]) => {
    if (this.#logger) {
      this.#logger('[OES]', msg, ...data);
    }
  };

  #decoders: Partial<Record<EncodingType, DecoderFunction>>;

  public get on() {
    return this.#emitter.on.bind(this.#emitter);
  }

  public get once() {
    return this.#emitter.once.bind(this.#emitter);
  }

  public get off() {
    return this.#emitter.off.bind(this.#emitter);
  }

  public get readyState() {
    return this.#es.readyState;
  }

  public get url() {
    return this.#es.url;
  }

  public close() {
    this.#es.close();
    this.#emitter.clearListeners();
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
    const source = new URL(
      `/e/${params.teamId}/${params.eventSourceId}/event-stream`,
      params.endpoint || 'https://events.oyen.io/',
    );

    if (params.logger) {
      this.#logger = params.logger;
    }

    source.searchParams.set('accessToken', params.accessToken);
    params.channels.forEach((channel) => {
      source.searchParams.append('channels', channel);
    });

    const timeout = (params.timeoutSecs || 15) * 1000;

    this.#decoders = params.decoders || defaultDecoders;

    this.#es = new ReconnectingEventSource(source.toString(), {
      ...params.eventSourceInit,
      ...('reconnectIntervalSecs' in params && {
        max_retry_time: (params.reconnectIntervalSecs || 5) * 1000,
      }),
      ...(params.lastEventId && {
        lastEventId: params.lastEventId?.toString(),
      }),
      ...(params.eventSourceClass && {
        eventSourceClass: params.eventSourceClass,
      }),
    });

    this.#emitter.onAny((event, payload) => {
      this.#log('emitter:onAny', event, payload);
    });

    const connectTimer = setTimeout(() => {
      if (this.#es.readyState !== ReadyState.OPEN) {
        this.#es.close();
        this.#emitter.emit(
          'error',
          new EventSourceTimeoutError('timeout during connect'),
        );
        this.#emitter.clearListeners();
      }
    }, timeout);

    this.#es.addEventListener('open', (e) => {
      this.#log('es:on:open', e);
      clearTimeout(connectTimer);
      if (this.#es.readyState === ReadyState.OPEN) {
        this.#emitter.emit('open');
      }
    });

    this.#es.addEventListener('message', async (e: MessageEvent<unknown>) => {
      this.#log('es:on:message', e);
      try {
        const raw = parseRawMessage(String(e.data));
        this.#log('saw raw', JSON.stringify(raw));

        const encodings = raw.enc.split('/') as EncodingType[];

        const decoded = await encodings.reduceRight<Promise<unknown>>(
          async (data, encoding) => {
            const decoder =
              encoding in this.#decoders ? this.#decoders[encoding] : null;

            if (!decoder) {
              throw new Error(
                `No decoder registered for encoding ${JSON.stringify(
                  encoding,
                )}`,
              );
            }

            return decoder(await data, encoding);
          },
          Promise.resolve(raw.d),
        );

        if (this.#validateMessage(decoded)) {
          this.#emitter.emit('message', {
            ...raw,
            d: decoded,
          });
        } else {
          this.#emitter.emit('exception', {
            ...raw,
            d: {
              message: 'Invalid message',
              statusCode: Status.INVALID_ARGUMENT,
            },
          });
        }
      } catch (err) {
        this.#emitter.emit(
          'error',
          new EventSourceParserError(
            err instanceof Error ? err.message : JSON.stringify(err),
            err,
          ),
        );
      }
    });

    this.#es.addEventListener('error', (e) => {
      this.#log('es:on:error', e);
      this.#emitter.emit(
        'error',
        new EventSourceError(
          'message' in e ? String(e.message) : `Error: ${JSON.stringify(e)}`,
        ).debug({
          type: e.type,
          status: e.status,
          returnValue: e.returnValue,
          timeStamp: e.timeStamp,
        }),
      );
    });
  }
}
