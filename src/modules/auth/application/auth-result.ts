/** The session that starts when an account is created or a login succeeds. */
export interface AuthResult {
  readonly accessToken: string;
  /** Seconds (D-44). */
  readonly expiresIn: number;
  readonly displayName: string;
}
