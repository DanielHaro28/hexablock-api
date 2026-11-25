import { randomUUID } from 'node:crypto';
import type { UseCase } from '../../../common/application/use-case.js';
import { InvalidCredentialsError } from '../../../common/domain/domain-error.js';
import type { IUserRepository } from '../../users/application/user-repository.js';
import type { AuthResult } from './auth-result.js';
import type { IPasswordHasher } from './password-hasher.js';
import type { ITokenIssuer } from './token-issuer.js';

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/**
 * API-02: starts a session. An unknown e-mail and a wrong password get the same error and the same work: when
 * there is no account, the password is checked against a hash that belongs to nobody, so the answer does not
 * take less time and does not reveal whether the e-mail exists (SEC-API-02, ARQ-03-API §2).
 */
export class LoginUseCase implements UseCase<Credentials, AuthResult> {
  /** A hash made by the same hasher (same cost) of a random password; created once, on the first login. */
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly users: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly tokens: ITokenIssuer,
  ) {}

  async execute(credentials: Credentials): Promise<AuthResult> {
    const user = await this.users.findCredentialsByEmail(credentials.email.toLowerCase());

    const hash = user?.passwordHash ?? (await this.hashOfNobody());
    const matches = await this.hasher.verify(hash, credentials.password);
    if (user === undefined || !matches) throw new InvalidCredentialsError();

    const { accessToken, expiresIn } = await this.tokens.issue({
      userId: user.id,
      role: user.role,
    });
    return { accessToken, expiresIn, displayName: user.displayName };
  }

  private hashOfNobody(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(randomUUID());
    return this.dummyHash;
  }
}
