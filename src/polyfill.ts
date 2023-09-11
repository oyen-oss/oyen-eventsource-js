import NodeEventSource from 'eventsource';

export class EventSource extends NodeEventSource {
  constructor(url: string | URL, init?: NodeEventSource.EventSourceInitDict) {
    super(url.toString(), init);
  }
}
