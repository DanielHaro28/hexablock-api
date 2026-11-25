import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedError } from '../../../common/domain/domain-error.js';
import type { Role } from '../../users/domain/user.js';
import type { AuthenticatedUser, ITokenVerifier } from '../application/token-verifier.js';

const ROLES: readonly string[] = ['USER', 'ADMIN'] satisfies Role[];

/**
 * Adapter of `ITokenVerifier`. The algorithm is fixed to HS256 when verifying, so `none` and any other
 * algorithm are refused whatever the header says (SEC-API-02). Whatever goes wrong is the same
 * `UnauthorizedError`: the reason (expired, altered, wrong key) is never told to the client.
 */
@Injectable()
export class JwtTokenVerifier implements ITokenVerifier {
  constructor(private readonly jwt: JwtService) {}

  async verify(token: string): Promise<AuthenticatedUser> {
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedError(true);
    }

    const { sub, role } = payload;
    if (
      typeof sub !== 'string' ||
      sub === '' ||
      typeof role !== 'string' ||
      !ROLES.includes(role)
    ) {
      throw new UnauthorizedError(true);
    }
    return { userId: sub, role: role as Role };
  }
}
