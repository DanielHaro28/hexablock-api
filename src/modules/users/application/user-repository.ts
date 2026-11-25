import type { NewUser, User } from '../domain/user.js';

/** Port of the stored accounts (ARQ-03-API §3). The Prisma adapter lives in `infrastructure/`. */
export interface IUserRepository {
  /**
   * Stores a new account with the role `USER`.
   * @throws ConflictError `email-taken` or `display-name-taken` (D-03, RN-COM-109); the e-mail wins when both
   * are taken. Both comparisons ignore case.
   */
  create(user: NewUser): Promise<User>;
}
