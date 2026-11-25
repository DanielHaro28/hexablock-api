import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedError } from '../../../common/domain/domain-error.js';
import { IS_PUBLIC_KEY } from '../../../common/presentation/public.js';
import type { ITokenVerifier } from '../application/token-verifier.js';
import { TOKEN_VERIFIER } from '../auth.tokens.js';
import type { AuthenticatedRequest } from './current-user.decorator.js';

/** `Authorization: Bearer <token>`; the scheme is not case sensitive (RFC 9110 §11.1). */
const BEARER = /^Bearer[ \t]+(\S+)$/i;

/**
 * Authentication with denial by default (SEC-API-02, ARQ-03-API §4): every route needs a valid token unless it
 * is marked `@Public()`. The token is read only from the `Authorization` header, never from the URL, where it
 * would end up in logs. A request without the header is a plain 401; one with a header that is not a usable
 * token (another scheme, an empty or invalid token) says `invalid_token` (RFC 6750 §3).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly verifier: ITokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (header === undefined) throw new UnauthorizedError();

    const token = BEARER.exec(header)?.[1];
    if (token === undefined) throw new UnauthorizedError(true);

    request.user = await this.verifier.verify(token);
    return true;
  }
}
