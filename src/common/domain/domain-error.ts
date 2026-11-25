/**
 * Typed errors of the API (D-39, ARQ-03-API §2). Inside, the domain and the use cases throw these; the adapters
 * translate technical errors (Prisma, argon2, JWT) to them. Outside, the global exception filter turns each one
 * into Problem Details (D-51). Plain TypeScript: no NestJS, no HTTP.
 *
 * The message of an error is for the server log only. It is never sent to the client (CWE-209).
 */

/** Stable identifiers read by the app: the `code` of `problem.schema.json`. */
export type ProblemCode =
  | 'validation-failed'
  | 'invalid-level'
  | 'implausible-result'
  | 'invalid-credentials'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'email-taken'
  | 'display-name-taken'
  | 'level-exists'
  | 'stale-version'
  | 'payload-too-large'
  | 'too-many-requests'
  | 'internal-error'
  | 'service-unavailable';

/** One problem in one field: a JSON Pointer (RFC 6901) and the rule that failed, never the submitted value. */
export interface FieldError {
  readonly pointer: string;
  readonly code: string;
}

export abstract class DomainError extends Error {
  abstract readonly code: ProblemCode;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The request does not meet the schema (400). `errors` says which field and which rule. */
export class ValidationError extends DomainError {
  readonly code = 'validation-failed';

  constructor(readonly errors: readonly FieldError[] = []) {
    super('Validation failed');
  }
}

/** A level breaks the schema or a structural rule of its variant (400), e.g. `rn-hf-12-d` (RN-COM-71). */
export class InvalidLevelError extends DomainError {
  readonly code = 'invalid-level';

  constructor(readonly errors: readonly FieldError[] = []) {
    super('Invalid level');
  }
}

/** A result that cannot happen: stars out of range, score over the cap, unknown level (400, RN-COM-108). */
export class ImplausibleResultError extends DomainError {
  readonly code = 'implausible-result';

  constructor() {
    super('Implausible result');
  }
}

/** Unknown email or wrong password. The same error and the same time in both cases (401, API-02). */
export class InvalidCredentialsError extends DomainError {
  readonly code = 'invalid-credentials';

  constructor() {
    super('Invalid credentials');
  }
}

/** No token, or an expired or altered one (401). */
export class UnauthorizedError extends DomainError {
  readonly code = 'unauthorized';

  /** True when a token was sent but it is not valid: the response says `error="invalid_token"` (RFC 6750 §3). */
  constructor(readonly invalidToken = false) {
    super('Unauthorized');
  }
}

/** The token is valid but the role is not enough (403, SEC-API-05). */
export class ForbiddenError extends DomainError {
  readonly code = 'forbidden';

  constructor() {
    super('Forbidden');
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'not-found';

  constructor() {
    super('Not found');
  }
}

/** The resource clashes with an existing one (409). */
export class ConflictError extends DomainError {
  constructor(
    readonly code: 'email-taken' | 'display-name-taken' | 'level-exists' | 'stale-version',
  ) {
    super(`Conflict: ${code}`);
  }
}

/** Too many requests from one IP (429). `retryAfterSeconds` goes to the `Retry-After` header (RFC 6585). */
export class TooManyRequestsError extends DomainError {
  readonly code = 'too-many-requests';

  constructor(readonly retryAfterSeconds: number) {
    super('Too many requests');
  }
}

/** The database is not reachable (503). Only `/health` raises it. */
export class ServiceUnavailableError extends DomainError {
  readonly code = 'service-unavailable';

  constructor() {
    super('Service unavailable');
  }
}
