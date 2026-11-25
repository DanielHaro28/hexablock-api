import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from '@jest/globals';
import { UnauthorizedError } from '../../../../src/common/domain/domain-error.js';
import { JwtTokenVerifier } from '../../../../src/modules/auth/infrastructure/jwt-token-verifier.js';

const SECRET = 'a-test-secret-with-more-than-32-bytes-0123456789';
const jwt = new JwtService({ secret: SECRET });
const verifier = new JwtTokenVerifier(jwt);

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** A rejection must be an `UnauthorizedError` that says a token arrived and it was not valid. */
async function expectInvalid(token: string): Promise<void> {
  const error = await verifier.verify(token).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(UnauthorizedError);
  expect((error as UnauthorizedError).invalidToken).toBe(true);
}

describe('SEC-API-02 · JwtTokenVerifier', () => {
  it('should_return_the_user_id_and_the_role_when_the_token_is_valid', async () => {
    // Arrange
    const token = await jwt.signAsync(
      { sub: 'user-1', role: 'ADMIN' },
      { algorithm: 'HS256', expiresIn: 60 },
    );

    // Act
    const user = await verifier.verify(token);

    // Assert
    expect(user).toEqual({ userId: 'user-1', role: 'ADMIN' });
  });

  it('should_reject_the_token_when_it_has_expired', async () => {
    // Arrange
    const token = await jwt.signAsync(
      { sub: 'user-1', role: 'USER' },
      { algorithm: 'HS256', expiresIn: -10 },
    );

    // Act + Assert
    await expectInvalid(token);
  });

  it('should_reject_the_token_when_the_payload_was_altered', async () => {
    // Arrange: the role is changed to ADMIN but the signature is the old one
    const token = await jwt.signAsync(
      { sub: 'user-1', role: 'USER' },
      { algorithm: 'HS256', expiresIn: 60 },
    );
    const [header = '', , signature = ''] = token.split('.');
    const altered = [
      header,
      base64url({ sub: 'user-1', role: 'ADMIN', exp: 9_999_999_999 }),
      signature,
    ];

    // Act + Assert
    await expectInvalid(altered.join('.'));
  });

  it('should_reject_the_token_when_it_was_signed_with_another_secret', async () => {
    // Arrange
    const other = new JwtService({ secret: 'another-secret-with-more-than-32-bytes-9876543210' });
    const token = await other.signAsync({ sub: 'user-1', role: 'USER' }, { expiresIn: 60 });

    // Act + Assert
    await expectInvalid(token);
  });

  it('should_reject_the_token_when_the_algorithm_is_none', async () => {
    // Arrange: an unsigned token that claims to be an admin
    const unsigned = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      sub: 'user-1',
      role: 'ADMIN',
      exp: 9_999_999_999,
    })}.`;

    // Act + Assert
    await expectInvalid(unsigned);
  });

  it('should_reject_the_token_when_it_was_signed_with_another_hmac_algorithm', async () => {
    // Arrange: same secret, HS512: the algorithm is fixed to HS256 when verifying
    const token = await jwt.signAsync(
      { sub: 'user-1', role: 'USER' },
      { algorithm: 'HS512', expiresIn: 60 },
    );

    // Act + Assert
    await expectInvalid(token);
  });

  it.each([
    ['without a subject', { role: 'USER' }],
    ['with an empty subject', { sub: '', role: 'USER' }],
    ['without a role', { sub: 'user-1' }],
    ['with an unknown role', { sub: 'user-1', role: 'ROOT' }],
  ])('should_reject_the_token_when_the_payload_is_%s', async (_label, payload) => {
    // Arrange
    const token = await jwt.signAsync(payload, { algorithm: 'HS256', expiresIn: 60 });

    // Act + Assert
    await expectInvalid(token);
  });

  it('should_reject_the_token_when_it_is_not_a_jwt', async () => {
    // Act + Assert
    await expectInvalid('not-a-token');
  });
});
