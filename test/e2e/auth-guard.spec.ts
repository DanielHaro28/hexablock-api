import type { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../support/test-app.js';

const SECRET = 'a-test-secret-with-more-than-32-bytes-0123456789';
const jwt = new JwtService({ secret: SECRET });

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('SEC-API-02 · routes are protected by default (JWT guard)', () => {
  let app: NestExpressApplication;

  /** `GET /__private/me` with the given `Authorization` header (none when `undefined`). */
  function getMe(authorization?: string) {
    const call = request(app.getHttpServer()).get('/__private/me');
    return authorization === undefined ? call : call.set('Authorization', authorization);
  }

  beforeAll(async () => {
    app = await createTestApp({ env: { THROTTLE_LIMIT: '1000' } });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('a valid token', () => {
    it('should_answer_200_with_the_user_of_the_token_when_the_token_is_valid', async () => {
      // Arrange
      const token = await jwt.signAsync(
        { sub: 'user-1', role: 'USER' },
        { algorithm: 'HS256', expiresIn: 60 },
      );

      // Act
      const response = await getMe(`Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ userId: 'user-1', role: 'USER' });
    });

    it('should_accept_the_scheme_in_any_case_when_the_token_is_valid', async () => {
      // Arrange
      const token = await jwt.signAsync(
        { sub: 'user-1', role: 'USER' },
        { algorithm: 'HS256', expiresIn: 60 },
      );

      // Act
      const response = await getMe(`bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should_ignore_a_user_id_in_the_url_when_the_token_names_another_user (SEC-API-01)', async () => {
      // Arrange
      const token = await jwt.signAsync(
        { sub: 'user-1', role: 'USER' },
        { algorithm: 'HS256', expiresIn: 60 },
      );

      // Act
      const response = await request(app.getHttpServer())
        .get('/__private/me?userId=user-2')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.body).toEqual({ userId: 'user-1', role: 'USER' });
    });
  });

  describe('no token', () => {
    it('should_answer_401_with_www_authenticate_bearer_when_there_is_no_authorization_header', async () => {
      // Act
      const response = await getMe();

      // Assert
      expect(response.status).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer');
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect((response.body as { code: string }).code).toBe('unauthorized');
    });

    it('should_answer_401_when_the_token_comes_in_the_query_string', async () => {
      // Arrange
      const token = await jwt.signAsync(
        { sub: 'user-1', role: 'USER' },
        { algorithm: 'HS256', expiresIn: 60 },
      );

      // Act
      const response = await request(app.getHttpServer()).get(
        `/__private/me?access_token=${token}`,
      );

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('a token that is not valid', () => {
    async function expectInvalidToken(authorization: string): Promise<void> {
      const response = await getMe(authorization);
      expect(response.status).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer error="invalid_token"');
      expect((response.body as { code: string }).code).toBe('unauthorized');
      // The answer never says why (expired, altered, wrong key) and never repeats the token
      expect(response.text).not.toContain(authorization.slice(7));
    }

    it('should_answer_401_when_the_token_has_expired', async () => {
      // Arrange
      const token = await jwt.signAsync(
        { sub: 'user-1', role: 'USER' },
        { algorithm: 'HS256', expiresIn: -10 },
      );

      // Act + Assert
      await expectInvalidToken(`Bearer ${token}`);
    });

    it('should_answer_401_when_the_signature_was_altered', async () => {
      // Arrange: a valid token with the last character of the signature changed
      const token = await jwt.signAsync(
        { sub: 'user-1', role: 'USER' },
        { algorithm: 'HS256', expiresIn: 60 },
      );
      const altered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');

      // Act + Assert
      await expectInvalidToken(`Bearer ${altered}`);
    });

    it('should_answer_401_when_the_payload_was_altered_to_become_an_admin', async () => {
      // Arrange
      const token = await jwt.signAsync(
        { sub: 'user-1', role: 'USER' },
        { algorithm: 'HS256', expiresIn: 60 },
      );
      const [header = '', , signature = ''] = token.split('.');
      const altered = `${header}.${base64url({ sub: 'user-1', role: 'ADMIN', exp: 9_999_999_999 })}.${signature}`;

      // Act + Assert
      await expectInvalidToken(`Bearer ${altered}`);
    });

    it('should_answer_401_when_the_token_has_no_signature_and_the_algorithm_is_none', async () => {
      // Arrange
      const unsigned = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
        sub: 'user-1',
        role: 'ADMIN',
        exp: 9_999_999_999,
      })}.`;

      // Act + Assert
      await expectInvalidToken(`Bearer ${unsigned}`);
    });

    it('should_answer_401_when_the_token_was_signed_with_another_secret', async () => {
      // Arrange
      const other = new JwtService({ secret: 'another-secret-with-more-than-32-bytes-9876543210' });
      const token = await other.signAsync({ sub: 'user-1', role: 'USER' }, { expiresIn: 60 });

      // Act + Assert
      await expectInvalidToken(`Bearer ${token}`);
    });

    it('should_answer_401_when_the_scheme_is_not_bearer', async () => {
      // Act + Assert
      await expectInvalidToken('Basic dXNlcjpwYXNz');
    });

    it('should_answer_401_when_the_bearer_token_is_empty', async () => {
      // Act
      const response = await getMe('Bearer ');

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('public routes', () => {
    it('should_answer_without_a_token_when_the_route_is_health', async () => {
      // Act
      const response = await request(app.getHttpServer()).get('/health');

      // Assert
      expect(response.status).toBe(200);
    });

    it('should_reach_validation_and_not_answer_401_when_the_route_is_register', async () => {
      // Act
      const response = await request(app.getHttpServer()).post('/v1/auth/register').send({});

      // Assert
      expect(response.status).toBe(400);
    });

    it('should_reach_validation_and_not_answer_401_when_the_route_is_login', async () => {
      // Act
      const response = await request(app.getHttpServer()).post('/v1/auth/login').send({});

      // Assert
      expect(response.status).toBe(400);
    });

    it('should_answer_the_swagger_ui_without_a_token_when_the_route_is_docs', async () => {
      // Act
      const response = await request(app.getHttpServer()).get('/docs');

      // Assert
      expect(response.status).toBe(200);
    });
  });
});
