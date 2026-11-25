/** The role of an account. It is never accepted from the client: every new account is a `USER` (SEC-API-03). */
export type Role = 'USER' | 'ADMIN';

/** An account as the application sees it. The password hash is not part of it: nothing but login needs it. */
export interface User {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: Role;
}

/** What is needed to create an account. The role is not here: the repository gives `USER`. */
export interface NewUser {
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string;
}
