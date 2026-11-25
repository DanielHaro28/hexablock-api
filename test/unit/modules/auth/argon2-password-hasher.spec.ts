import { describe, expect, it } from '@jest/globals';
import { verify } from 'argon2';
import { Argon2PasswordHasher } from '../../../../src/modules/auth/infrastructure/argon2-password-hasher.js';

describe('SEC-API-02 · Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('should_produce_an_argon2id_hash_that_is_not_the_password_when_hashing', async () => {
    // Arrange
    const password = 'a long passphrase of mine';

    // Act
    const hash = await hasher.hash(password);

    // Assert
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$/);
    expect(hash).not.toContain(password);
  });

  it('should_produce_a_hash_that_verifies_with_the_same_password_when_hashing', async () => {
    // Arrange
    const password = 'a long passphrase of mine';

    // Act
    const hash = await hasher.hash(password);

    // Assert
    await expect(verify(hash, password)).resolves.toBe(true);
    await expect(verify(hash, `${password}!`)).resolves.toBe(false);
  });

  it('should_use_a_different_salt_each_time_when_the_same_password_is_hashed_twice', async () => {
    // Arrange
    const password = 'a long passphrase of mine';

    // Act
    const [first, second] = await Promise.all([hasher.hash(password), hasher.hash(password)]);

    // Assert
    expect(first).not.toBe(second);
  });

  it('should_not_truncate_the_password_when_it_has_128_characters', async () => {
    // Arrange: two passwords that differ only in the last character
    const base = 'x'.repeat(127);

    // Act
    const hash = await hasher.hash(`${base}a`);

    // Assert
    await expect(verify(hash, `${base}a`)).resolves.toBe(true);
    await expect(verify(hash, `${base}b`)).resolves.toBe(false);
  });
});
