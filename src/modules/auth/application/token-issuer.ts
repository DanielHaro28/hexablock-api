import type { Role } from '../../users/domain/user.js';

/** Port that signs the session token (ARQ-03-API §3). */
export interface ITokenIssuer {
  /** A token for `userId` that lasts `expiresIn` seconds (D-44). */
  issue(subject: { readonly userId: string; readonly role: Role }): Promise<IssuedToken>;
}

export interface IssuedToken {
  readonly accessToken: string;
  /** Seconds until the token expires. */
  readonly expiresIn: number;
}
