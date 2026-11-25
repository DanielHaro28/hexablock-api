import type { FieldError, ProblemCode } from '../domain/domain-error.js';

/**
 * Problem Details (RFC 9457) as the API sends them (D-51, `problem.schema.json`). `title` and `detail` are fixed
 * per type, in English, and never carry submitted values, table names, paths or library messages (CWE-209).
 */
export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance: string;
  readonly code: ProblemCode;
  readonly errors?: readonly FieldError[];
}

interface ProblemType {
  readonly status: number;
  readonly title: string;
  readonly detail: string;
}

/** Every problem the API can answer: one row per `code` of the contract. */
export const PROBLEM_CATALOG: Readonly<Record<ProblemCode, ProblemType>> = {
  'validation-failed': {
    status: 400,
    title: 'Invalid request',
    detail: 'One or more fields are invalid.',
  },
  'invalid-level': {
    status: 400,
    title: 'Invalid level',
    detail: 'The level does not meet the rules of its variant.',
  },
  'implausible-result': {
    status: 400,
    title: 'Implausible result',
    detail: 'The submitted result is not possible.',
  },
  'invalid-credentials': {
    status: 401,
    title: 'Invalid credentials',
    detail: 'The email or the password is wrong.',
  },
  unauthorized: {
    status: 401,
    title: 'Unauthorized',
    detail: 'A valid token is required.',
  },
  forbidden: {
    status: 403,
    title: 'Forbidden',
    detail: 'You do not have permission to do this.',
  },
  'not-found': {
    status: 404,
    title: 'Not found',
    detail: 'The resource does not exist.',
  },
  'email-taken': {
    status: 409,
    title: 'Email already registered',
    detail: 'Use a different email or sign in.',
  },
  'display-name-taken': {
    status: 409,
    title: 'Display name already taken',
    detail: 'Choose a different display name.',
  },
  'level-exists': {
    status: 409,
    title: 'Level already exists',
    detail: 'Use PUT to update the level.',
  },
  'stale-version': {
    status: 409,
    title: 'Stale version',
    detail: 'The version must be greater than the stored one.',
  },
  'payload-too-large': {
    status: 413,
    title: 'Payload too large',
    detail: 'The request body is larger than 100 KB.',
  },
  'too-many-requests': {
    status: 429,
    title: 'Too many requests',
    detail: 'Wait the number of seconds in the Retry-After header and try again.',
  },
  'internal-error': {
    status: 500,
    title: 'Internal error',
    detail: 'Something went wrong. Report the id in the instance field.',
  },
  'service-unavailable': {
    status: 503,
    title: 'Service unavailable',
    detail: 'The database is not reachable.',
  },
};

/** The contract allows at most 50 entries in `errors` (`problem.schema.json`). */
export const MAX_FIELD_ERRORS = 50;

/**
 * Builds the body of an error response. `type` is `<PROBLEM_BASE_URI><code>` and `instance` is
 * `urn:uuid:<correlation id>`, the same id the server writes to its log (ASVS 7.4.1).
 */
export function buildProblem(
  problemBaseUri: string,
  code: ProblemCode,
  correlationId: string,
  errors?: readonly FieldError[],
): ProblemDetails {
  const { status, title, detail } = PROBLEM_CATALOG[code];
  return {
    type: `${problemBaseUri}${code}`,
    title,
    status,
    detail,
    instance: `urn:uuid:${correlationId}`,
    code,
    // Field errors only travel in 400 responses.
    ...(status === 400 && errors !== undefined
      ? { errors: errors.slice(0, MAX_FIELD_ERRORS) }
      : {}),
  };
}
