import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** A request that went through `correlationIdMiddleware`. */
export type CorrelatedRequest = Request & { correlationId?: string };

/**
 * Gives every request one id (SEC-WEB-06, ASVS 7.4.1). It is written to the access log and, as
 * `instance: urn:uuid:<id>`, to the error response, so an error can be found in the log without showing details.
 * The id is always generated here: one that arrives from the client is never trusted.
 */
export function correlationIdMiddleware(
  req: CorrelatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  req.correlationId = randomUUID();
  next();
}
