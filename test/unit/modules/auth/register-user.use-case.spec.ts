import { beforeEach, describe, expect, it } from '@jest/globals';
import { ConflictError, ValidationError } from '../../../../src/common/domain/domain-error.js';
import { RegisterUserUseCase } from '../../../../src/modules/auth/application/register-user.use-case.js';
import {
  FakePasswordHasher,
  FakeTokenIssuer,
  InMemoryUserRepository,
} from '../../../support/fake-auth-ports.js';

const INPUT = {
  email: 'Ana.Perez@Example.com',
  password: 'a long passphrase of mine',
  displayName: 'AnaP',
} as const;

describe('API-01 · RegisterUserUseCase', () => {
  let users: InMemoryUserRepository;
  let hasher: FakePasswordHasher;
  let tokens: FakeTokenIssuer;
  let register: RegisterUserUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    tokens = new FakeTokenIssuer();
    register = new RegisterUserUseCase(users, hasher, tokens);
  });

  it('should_create_the_account_and_return_a_token_when_the_data_is_valid', async () => {
    // Act
    const result = await register.execute(INPUT);

    // Assert
    expect(result).toEqual({
      accessToken: 'token-for-user-1',
      expiresIn: 86400,
      displayName: 'AnaP',
    });
    expect(users.stored).toHaveLength(1);
  });

  it('should_create_a_user_with_the_user_role_when_the_account_is_registered', async () => {
    // Act
    await register.execute(INPUT);

    // Assert
    expect(users.stored[0]?.role).toBe('USER');
    expect(tokens.issuedFor).toEqual([{ userId: 'user-1', role: 'USER' }]);
  });

  it('should_store_the_hash_and_never_the_password_when_the_account_is_created', async () => {
    // Act
    await register.execute(INPUT);

    // Assert
    expect(hasher.hashed).toEqual([INPUT.password]);
    expect(users.stored[0]?.passwordHash).not.toBe(INPUT.password);
    expect(JSON.stringify(users.stored)).not.toContain(INPUT.password);
  });

  it('should_store_the_email_in_lower_case_when_it_has_capitals', async () => {
    // Act
    await register.execute(INPUT);

    // Assert
    expect(users.stored[0]?.email).toBe('ana.perez@example.com');
  });

  it('should_answer_email_taken_when_the_email_exists_with_other_capitals', async () => {
    // Arrange
    await register.execute(INPUT);

    // Act
    const second = register.execute({
      ...INPUT,
      email: 'ANA.PEREZ@EXAMPLE.COM',
      displayName: 'Other',
    });

    // Assert
    await expect(second).rejects.toBeInstanceOf(ConflictError);
    await expect(second).rejects.toMatchObject({ code: 'email-taken' });
  });

  it('should_answer_display_name_taken_when_the_name_exists_with_other_capitals', async () => {
    // Arrange
    await register.execute(INPUT);

    // Act
    const second = register.execute({ ...INPUT, email: 'other@example.com', displayName: 'anap' });

    // Assert
    await expect(second).rejects.toMatchObject({ code: 'display-name-taken' });
  });

  describe('SEC-API-02 · password rules', () => {
    it.each([
      ['a'.repeat(14), 'too-short'],
      ['a'.repeat(129), 'too-long'],
      ['1q2w3e4r5t6y7u8i9o0p', 'too-common'],
    ])(
      'should_reject_the_password_with_its_code_when_it_breaks_a_rule (%#)',
      async (password, code) => {
        // Act
        const attempt = register.execute({ ...INPUT, password });

        // Assert
        await expect(attempt).rejects.toBeInstanceOf(ValidationError);
        await expect(attempt).rejects.toMatchObject({ errors: [{ pointer: '/password', code }] });
      },
    );

    it('should_not_hash_nor_store_anything_when_the_password_breaks_a_rule', async () => {
      // Act
      await register.execute({ ...INPUT, password: 'short' }).catch(() => undefined);

      // Assert
      expect(hasher.hashed).toEqual([]);
      expect(users.stored).toEqual([]);
      expect(tokens.issuedFor).toEqual([]);
    });

    it('should_not_repeat_the_password_when_the_error_is_built', async () => {
      // Act
      const error = await register
        .execute({ ...INPUT, password: 'tiny-secret' })
        .catch((caught: unknown) => caught);

      // Assert
      expect(JSON.stringify(error)).not.toContain('tiny-secret');
    });
  });
});
