import { describe, expect, it } from '@jest/globals';
import { hash as argon2Hash, verify } from 'argon2';
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

  it('should_verify_the_password_of_a_hash_it_made_when_verifying', async () => {
    // Arrange
    const hash = await hasher.hash('a long passphrase of mine');

    // Act
    const right = await hasher.verify(hash, 'a long passphrase of mine');
    const wrong = await hasher.verify(hash, 'a long passphrase of mine!');

    // Assert
    expect(right).toBe(true);
    expect(wrong).toBe(false);
  });

  it('should_verify_a_hash_with_other_parameters_when_the_cost_was_raised_later', async () => {
    // Arrange: a hash stored with the library defaults, not with the setting of the hasher
    const stored = await argon2Hash('a long passphrase of mine', { type: 2 });

    // Act
    const matches = await hasher.verify(stored, 'a long passphrase of mine');

    // Assert
    expect(matches).toBe(true);
  });

  it('should_answer_false_and_not_throw_when_the_stored_hash_is_not_a_hash', async () => {
    // Act
    const matches = await hasher.verify('not-a-hash', 'a long passphrase of mine');

    // Assert
    expect(matches).toBe(false);
  });
});
