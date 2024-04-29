/* eslint-disable max-classes-per-file */
import { CustomError, Status } from '@block65/custom-error';

export class EventTargetError extends CustomError {
  public override code = Status.UNKNOWN;
}

export class EventSourceError extends CustomError {
  public override code = Status.UNKNOWN;
}

export class EventSourceTimeoutError extends EventSourceError {
  public override code = Status.DEADLINE_EXCEEDED;
}

export class EventSourceParserError extends EventSourceError {
  public override code = Status.INVALID_ARGUMENT;
}

export class EventSourceDecoderError extends EventSourceError {
  public override code = Status.INVALID_ARGUMENT;
}

export class EventSourceEncoderError extends EventSourceError {
  public override code = Status.INVALID_ARGUMENT;
}
