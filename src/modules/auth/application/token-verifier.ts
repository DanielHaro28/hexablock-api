import type { Role } from '../../users/domain/user.js';

/** Who is calling, as the signed token says. The user id always comes from here, never from the request (SEC-API-01). */
export interface AuthenticatedUser {
  readonly userId: string;
  readonly role: Role;
}

/** Port that checks a session token (ARQ-03-API §4, the guard of authentication). */
export interface ITokenVerifier {
  /**
   * @throws UnauthorizedError (with `invalidToken`) when the token is altered, expired, signed with another
   * algorithm or key, or does not have the claims this API puts in its tokens.
   */
  verify(token: string): Promise<AuthenticatedUser>;
}
