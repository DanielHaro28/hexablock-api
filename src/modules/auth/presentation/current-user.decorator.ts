import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../application/token-verifier.js';

/** The request after the JWT guard: it carries the user that the token names. */
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/**
 * The caller, as the signed token says (SEC-API-01): the user id of every `/v1/me/*` route comes from here and
 * never from the URL, the query or the body. Only available on routes that are not `@Public()`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (user === undefined) {
      // A route without `@Public()` always has a user after the guard; this is a programming error.
      throw new Error('CurrentUser used on a route that the JWT guard did not authenticate');
    }
    return user;
  },
);
