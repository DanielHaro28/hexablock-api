import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from '@jest/globals';
import type { AppConfig } from '../../../../src/common/config/app-config.js';
import { JwtTokenIssuer } from '../../../../src/modules/auth/infrastructure/jwt-token-issuer.js';

const SECRET = 'a-test-secret-with-more-than-32-bytes-0123456789';
const CONFIG = { jwtSecret: SECRET, jwtExpiresInSeconds: 86_400 } as AppConfig;

function issuer(): JwtTokenIssuer {
  return new JwtTokenIssuer(new JwtService({ secret: SECRET }), CONFIG);
}

function decodeHeader(token: string): { alg: string } {
  const [header = ''] = token.split('.');
  return JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg: string };
}

describe('SEC-API-02 · JwtTokenIssuer', () => {
  it('should_sign_with_hs256_when_the_token_is_issued', async () => {
    // Act
    const { accessToken } = await issuer().issue({ userId: 'user-1', role: 'USER' });

    // Assert
    expect(decodeHeader(accessToken).alg).toBe('HS256');
  });

  it('should_expire_in_24_hours_and_say_so_when_the_token_is_issued (D-44)', async () => {
    // Act
    const { accessToken, expiresIn } = await issuer().issue({ userId: 'user-1', role: 'USER' });

    // Assert
    const payload = await new JwtService({ secret: SECRET }).verifyAsync<{
      iat: number;
      exp: number;
    }>(accessToken, { algorithms: ['HS256'] });
    expect(expiresIn).toBe(86_400);
    expect(payload.exp - payload.iat).toBe(86_400);
  });

  it('should_carry_only_the_user_id_and_the_role_when_the_token_is_issued (SEC-API-01, SEC-API-03)', async () => {
    // Act
    const { accessToken } = await issuer().issue({ userId: 'user-1', role: 'ADMIN' });

    // Assert
    const payload = await new JwtService({ secret: SECRET }).verifyAsync<Record<string, unknown>>(
      accessToken,
      { algorithms: ['HS256'] },
    );
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'role', 'sub']);
    expect(payload).toMatchObject({ sub: 'user-1', role: 'ADMIN' });
  });

  it('should_not_verify_with_another_secret_when_the_token_is_issued', async () => {
    // Act
    const { accessToken } = await issuer().issue({ userId: 'user-1', role: 'USER' });

    // Assert
    const other = new JwtService({ secret: 'another-secret-with-more-than-32-bytes-9876543210' });
    await expect(other.verifyAsync(accessToken, { algorithms: ['HS256'] })).rejects.toThrow();
  });
});
