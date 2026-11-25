import { ConflictError } from '../../src/common/domain/domain-error.js';
import type { IPasswordHasher } from '../../src/modules/auth/application/password-hasher.js';
import type { ITokenIssuer, IssuedToken } from '../../src/modules/auth/application/token-issuer.js';
import type { IUserRepository } from '../../src/modules/users/application/user-repository.js';
import type { NewUser, Role, User, UserCredentials } from '../../src/modules/users/domain/user.js';

/** Hand-written fakes of the account ports (D-56): they keep the data in memory and record what they got. */
export class InMemoryUserRepository implements IUserRepository {
  readonly stored: (User & { readonly passwordHash: string })[] = [];

  create(user: NewUser): Promise<User> {
    const email = user.email.toLowerCase();
    const displayName = user.displayName.toLowerCase();
    if (this.stored.some((existing) => existing.email.toLowerCase() === email)) {
      return Promise.reject(new ConflictError('email-taken'));
    }
    if (this.stored.some((existing) => existing.displayName.toLowerCase() === displayName)) {
      return Promise.reject(new ConflictError('display-name-taken'));
    }
    const created = { id: `user-${this.stored.length + 1}`, role: 'USER' as const, ...user };
    this.stored.push(created);
    return Promise.resolve({
      id: created.id,
      email: created.email,
      displayName: created.displayName,
      role: created.role,
    });
  }

  findCredentialsByEmail(email: string): Promise<UserCredentials | undefined> {
    const found = this.stored.find((user) => user.email.toLowerCase() === email.toLowerCase());
    return Promise.resolve(
      found === undefined
        ? undefined
        : {
            id: found.id,
            displayName: found.displayName,
            role: found.role,
            passwordHash: found.passwordHash,
          },
    );
  }
}

/** A hash that is readable on purpose, so a test can tell what was hashed and what was verified. */
export class FakePasswordHasher implements IPasswordHasher {
  readonly hashed: string[] = [];
  readonly verified: { hash: string; password: string }[] = [];

  hash(password: string): Promise<string> {
    this.hashed.push(password);
    return Promise.resolve(`hash-of:${password.length}:${password.split('').reverse().join('')}`);
  }

  verify(hash: string, password: string): Promise<boolean> {
    this.verified.push({ hash, password });
    return Promise.resolve(
      hash === `hash-of:${password.length}:${password.split('').reverse().join('')}`,
    );
  }
}

export class FakeTokenIssuer implements ITokenIssuer {
  readonly issuedFor: { userId: string; role: Role }[] = [];

  issue(subject: { readonly userId: string; readonly role: Role }): Promise<IssuedToken> {
    this.issuedFor.push({ ...subject });
    return Promise.resolve({ accessToken: `token-for-${subject.userId}`, expiresIn: 86400 });
  }
}
