import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../users/domain/user.js';

export const ROLES_KEY = 'roles';

/**
 * The roles that may call a route (SEC-API-05): `@Roles('ADMIN')`. A route without it is open to every
 * authenticated user; the guard of authentication already denies the callers without a token.
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
