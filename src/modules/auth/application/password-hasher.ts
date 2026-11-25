/** Port of the password hashing (ARQ-03-API §3). The adapter uses argon2id (SEC-WEB-04). */
export interface IPasswordHasher {
  /** A salted hash that includes its own parameters. The password is never stored or logged. */
  hash(password: string): Promise<string>;
}
