import { HttpException } from '@nestjs/common';
import {
  DomainError,
  type FieldError,
  InvalidLevelError,
  type ProblemCode,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from '../domain/domain-error.js';

/** What the filter needs to answer: the problem `code`, the field errors and the headers of its status. */
export interface MappedException {
  readonly code: ProblemCode;
  readonly errors?: readonly FieldError[];
  readonly headers: Readonly<Record<string, string>>;
  /** The error that must be logged with its stack (only for the unexpected ones). */
  readonly unexpected?: unknown;
}

/** Seconds to wait when a throttling error arrives without a precise number. */
const DEFAULT_RETRY_AFTER_SECONDS = 60;

const BEARER = 'Bearer';
const BEARER_INVALID_TOKEN = 'Bearer error="invalid_token"';

/** A malformed or unreadable request has no specific field: the pointer is the whole document. */
const WHOLE_BODY: readonly FieldError[] = [{ pointer: '', code: 'invalid-request' }];

/**
 * Turns anything that can be thrown into one of the problems of the contract (D-51). It also covers the errors
 * of the framework and of the body parser (malformed JSON, body too large, unknown route), so no message of a
 * library reaches the client (CWE-211, SEC-WEB-07). Whatever is not recognised is an internal error.
 */
export function mapException(exception: unknown): MappedException {
  if (exception instanceof DomainError) return mapDomainError(exception);

  const status = httpStatusOf(exception);
  if (status !== undefined) return mapHttpStatus(status, exception);

  return { code: 'internal-error', headers: {}, unexpected: exception };
}

function mapDomainError(error: DomainError): MappedException {
  if (error instanceof ValidationError || error instanceof InvalidLevelError) {
    return { code: error.code, errors: error.errors, headers: {} };
  }
  if (error instanceof TooManyRequestsError) {
    return { code: error.code, headers: { 'Retry-After': String(error.retryAfterSeconds) } };
  }
  if (error instanceof UnauthorizedError) {
    return {
      code: error.code,
      headers: { 'WWW-Authenticate': error.invalidToken ? BEARER_INVALID_TOKEN : BEARER },
    };
  }
  if (error.code === 'invalid-credentials') {
    return { code: error.code, headers: { 'WWW-Authenticate': BEARER } };
  }
  return { code: error.code, headers: {} };
}

/** HTTP status of a Nest exception or of an `http-errors` object from Express middleware. */
function httpStatusOf(exception: unknown): number | undefined {
  if (exception instanceof HttpException) return exception.getStatus();
  if (exception instanceof Error) {
    const { status, statusCode } = exception as { status?: unknown; statusCode?: unknown };
    const value = typeof status === 'number' ? status : statusCode;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 400 && value <= 599) {
      return value;
    }
  }
  return undefined;
}

function mapHttpStatus(status: number, exception: unknown): MappedException {
  switch (status) {
    case 401:
      return { code: 'unauthorized', headers: { 'WWW-Authenticate': BEARER } };
    case 403:
      return { code: 'forbidden', headers: {} };
    case 404:
      return { code: 'not-found', headers: {} };
    case 413:
      return { code: 'payload-too-large', headers: {} };
    case 429:
      return {
        code: 'too-many-requests',
        headers: { 'Retry-After': String(DEFAULT_RETRY_AFTER_SECONDS) },
      };
    default:
      if (status >= 500) return { code: 'internal-error', headers: {}, unexpected: exception };
      return {
        code: 'validation-failed',
        errors: WHOLE_BODY,
        headers: {},
      };
  }
}
