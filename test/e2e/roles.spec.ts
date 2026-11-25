import type { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../support/test-app.js';

const jwt = new JwtService({ secret: 'a-test-secret-with-more-than-32-bytes-0123456789' });

describe('SEC-API-05 · routes for administrators', () => {
  let app: NestExpressApplication;

  function getAdmin(token?: string) {
    const call = request(app.getHttpServer()).get('/__private/admin');
    return token === undefined ? call : call.set('Authorization', `Bearer ${token}`);
  }

  function tokenOf(role: string): Promise<string> {
    return jwt.signAsync({ sub: 'user-1', role }, { algorithm: 'HS256', expiresIn: 60 });
  }

  beforeAll(async () => {
    app = await createTestApp({ env: { THROTTLE_LIMIT: '1000' } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should_answer_200_when_the_token_has_the_admin_role', async () => {
    // Act
    const response = await getAdmin(await tokenOf('ADMIN'));

    // Assert
    expect(response.status).toBe(200);
  });

  it('should_answer_403_when_the_token_has_the_user_role', async () => {
    // Act
    const response = await getAdmin(await tokenOf('USER'));

    // Assert
    expect(response.status).toBe(403);
    expect((response.body as { code: string }).code).toBe('forbidden');
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
  });

  it('should_answer_401_and_not_403_when_there_is_no_token', async () => {
    // Act
    const response = await getAdmin();

    // Assert
    expect(response.status).toBe(401);
  });

  it('should_not_say_which_role_is_needed_when_the_answer_is_403', async () => {
    // Act
    const response = await getAdmin(await tokenOf('USER'));

    // Assert
    expect(response.text).not.toContain('ADMIN');
  });

  it('should_let_every_authenticated_role_reach_a_route_without_roles_when_the_route_is_private', async () => {
    // Act
    const response = await request(app.getHttpServer())
      .get('/__private/me')
      .set('Authorization', `Bearer ${await tokenOf('USER')}`);

    // Assert
    expect(response.status).toBe(200);
  });
});
