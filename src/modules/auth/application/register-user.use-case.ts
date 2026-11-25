import type { UseCase } from '../../../common/application/use-case.js';
import { ValidationError } from '../../../common/domain/domain-error.js';
import type { IUserRepository } from '../../users/application/user-repository.js';
import { PasswordPolicy } from '../domain/password-policy.js';
import type { IPasswordHasher } from './password-hasher.js';
import type { ITokenIssuer } from './token-issuer.js';

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

/** The session that starts when an account is created or a login succeeds. */
export interface AuthResult {
  readonly accessToken: string;
  /** Seconds (D-44). */
  readonly expiresIn: number;
  readonly displayName: string;
}

/**
 * API-01: creates an account and starts its session. The password rules are checked first, so a rejected
 * password is never hashed (the hash is the costly step), and the e-mail is stored in lower case (the contract).
 * The role is not an input: every account starts as `USER` (SEC-API-03).
 */
export class RegisterUserUseCase implements UseCase<RegisterInput, AuthResult> {
  constructor(
    private readonly users: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly tokens: ITokenIssuer,
  ) {}

  async execute(input: RegisterInput): Promise<AuthResult> {
    const violation = PasswordPolicy.violation(input.password);
    if (violation !== undefined) {
      throw new ValidationError([{ pointer: '/password', code: violation }]);
    }

    const user = await this.users.create({
      email: input.email.toLowerCase(),
      passwordHash: await this.hasher.hash(input.password),
      displayName: input.displayName,
    });
    const { accessToken, expiresIn } = await this.tokens.issue({
      userId: user.id,
      role: user.role,
    });
    return { accessToken, expiresIn, displayName: user.displayName };
  }
}
