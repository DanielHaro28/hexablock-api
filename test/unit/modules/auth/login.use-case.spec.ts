import { beforeEach, describe, expect, it } from '@jest/globals';
import { InvalidCredentialsError } from '../../../../src/common/domain/domain-error.js';
import { LoginUseCase } from '../../../../src/modules/auth/application/login.use-case.js';
import {
  FakePasswordHasher,
  FakeTokenIssuer,
  InMemoryUserRepository,
} from '../../../support/fake-auth-ports.js';

const PASSWORD = 'a long passphrase of mine';

/** The error of an attempt that must fail. */
async function failureOf(attempt: Promise<unknown>): Promise<InvalidCredentialsError> {
  try {
    await attempt;
  } catch (error) {
    return error as InvalidCredentialsError;
  }
  throw new Error('The login should have failed');
}

describe('API-02 · LoginUseCase', () => {
  let users: InMemoryUserRepository;
  let hasher: FakePasswordHasher;
  let tokens: FakeTokenIssuer;
  let login: LoginUseCase;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    tokens = new FakeTokenIssuer();
    login = new LoginUseCase(users, hasher, tokens);
    await users.create({
      email: 'ana@example.com',
      passwordHash: await hasher.hash(PASSWORD),
      displayName: 'AnaP',
    });
    hasher.hashed.length = 0;
  });

  it('should_return_a_token_when_the_credentials_are_correct', async () => {
    // Act
    const result = await login.execute({ email: 'ana@example.com', password: PASSWORD });

    // Assert
    expect(result).toEqual({
      accessToken: 'token-for-user-1',
      expiresIn: 86400,
      displayName: 'AnaP',
    });
    expect(tokens.issuedFor).toEqual([{ userId: 'user-1', role: 'USER' }]);
  });

  it('should_ignore_the_case_of_the_email_when_the_credentials_are_correct', async () => {
    // Act
    const result = await login.execute({ email: 'ANA@Example.COM', password: PASSWORD });

    // Assert
    expect(result.displayName).toBe('AnaP');
  });

  describe('SEC-API-02 · the same answer and the same work for any wrong credentials', () => {
    it('should_reject_with_invalid_credentials_when_the_password_is_wrong', async () => {
      // Act
      const attempt = login.execute({ email: 'ana@example.com', password: 'another passphrase!' });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(InvalidCredentialsError);
      expect(tokens.issuedFor).toEqual([]);
    });

    it('should_reject_with_the_same_error_when_the_email_does_not_exist', async () => {
      // Arrange
      const wrongPassword = await failureOf(
        login.execute({ email: 'ana@example.com', password: 'another passphrase!' }),
      );

      // Act
      const unknownEmail = await failureOf(
        login.execute({ email: 'nobody@example.com', password: PASSWORD }),
      );

      // Assert
      expect(unknownEmail).toBeInstanceOf(InvalidCredentialsError);
      expect(unknownEmail.code).toBe(wrongPassword.code);
      expect(unknownEmail.message).toBe(wrongPassword.message);
      expect(tokens.issuedFor).toEqual([]);
    });

    it('should_check_one_hash_when_the_email_does_not_exist_like_when_it_does', async () => {
      // Act
      await login
        .execute({ email: 'ana@example.com', password: 'another passphrase!' })
        .catch(() => 0);
      const checksForKnownEmail = hasher.verified.length;
      hasher.verified.length = 0;
      await login.execute({ email: 'nobody@example.com', password: PASSWORD }).catch(() => 0);

      // Assert: the costly step runs in both cases, so the time does not tell them apart
      expect(checksForKnownEmail).toBe(1);
      expect(hasher.verified).toHaveLength(1);
    });

    it('should_not_accept_the_password_when_the_email_does_not_exist_whatever_the_dummy_hash_is', async () => {
      // Act
      const attempt = login.execute({ email: 'nobody@example.com', password: PASSWORD });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(InvalidCredentialsError);
      expect(hasher.verified[0]?.hash).not.toBe(users.stored[0]?.passwordHash);
    });
  });
});
