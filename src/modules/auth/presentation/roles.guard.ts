import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError } from '../../../common/domain/domain-error.js';
import type { Role } from '../../users/domain/user.js';
import type { AuthenticatedRequest } from './current-user.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';

/**
 * Authorization by role (SEC-API-05, ARQ-03-API §4). It runs after the guard of authentication, so the user is
 * the one the signed token names; a route without `@Roles` is open to any authenticated user. A caller with the
 * wrong role gets a plain 403: the answer does not say which role was needed.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    // A public route has no user; `@Roles` on one is a mistake, and the safe answer is to deny it
    if (user === undefined || !required.includes(user.role)) throw new ForbiddenError();
    return true;
  }
}
