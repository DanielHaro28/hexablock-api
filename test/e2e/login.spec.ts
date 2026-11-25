import type { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { PrismaClient } from '../../src/prisma/generated/client.js';
import { createContractChecker } from '../support/contract.js';
import { createTestApp } from '../support/test-app.js';
import { createTestPrisma, truncateAll } from '../support/test-database.js';

const JWT_SECRET = 'a-test-secret-with-more-than-32-bytes-0123456789';
const ACCOUNT = {
  email: 'ana@example.com',
  password: 'a long passphrase of mine',
  displayName: 'AnaP',
} as const;

interface ProblemBody {
  code: string;
  instance: string;
  errors?: { pointer: string; code: string }[];
}

let contract: Awaited<ReturnType<typeof createContractChecker>>;
let prisma: PrismaClient;

beforeAll(async () => {
  contract = await createContractChecker();
  prisma = createTestPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('API-02 · POST /v1/auth/login (PostgreSQL)', () => {
  let app: NestExpressApplication;

  /** Sends a login body, checks the answer against the contract and returns it. */
  async function login(body: unknown) {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send(body as object);
    expect(
      contract.check('post', '/v1/auth/login', {
        status: response.status,
        headers: response.headers,
        body: response.body,
      }),
    ).toEqual([]);
    return response;
  }

  beforeAll(async () => {
    app = await createTestApp({
      database: true,
      env: { THROTTLE_AUTH_LIMIT: '1000', THROTTLE_LIMIT: '1000' },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await request(app.getHttpServer()).post('/v1/auth/register').send(ACCOUNT).expect(201);
  });

  describe('correct credentials', () => {
    it('should_answer_200_with_a_token_when_the_credentials_are_correct', async () => {
      // Act
      const response = await login({ email: ACCOUNT.email, password: ACCOUNT.password });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        accessToken: expect.any(String) as unknown as string,
        tokenType: 'Bearer',
        expiresIn: 86_400,
        displayName: 'AnaP',
      });
    });

    it('should_issue_a_token_of_that_user_that_expires_in_24_hours_when_the_login_succeeds', async () => {
      // Act
      const response = await login({ email: ACCOUNT.email, password: ACCOUNT.password });

      // Assert
      const stored = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNT.email } });
      const payload = await new JwtService({ secret: JWT_SECRET }).verifyAsync<{
        sub: string;
        role: string;
        iat: number;
        exp: number;
      }>((response.body as { accessToken: string }).accessToken, { algorithms: ['HS256'] });
      expect(payload).toMatchObject({ sub: stored.id, role: 'USER' });
      expect(payload.exp - payload.iat).toBe(86_400);
    });

    it('should_answer_200_when_the_email_has_other_capitals', async () => {
      // Act
      const response = await login({ email: 'ANA@Example.COM', password: ACCOUNT.password });

      // Assert
      expect(response.status).toBe(200);
    });

    it('should_not_return_the_email_or_the_hash_when_the_login_succeeds', async () => {
      // Act
      const response = await login({ email: ACCOUNT.email, password: ACCOUNT.password });

      // Assert
      expect(response.text).not.toContain(ACCOUNT.email);
      expect(response.text).not.toContain('argon2');
    });

    it('should_let_the_token_reach_a_protected_route_when_the_login_succeeds', async () => {
      // Arrange
      const response = await login({ email: ACCOUNT.email, password: ACCOUNT.password });
      const token = (response.body as { accessToken: string }).accessToken;

      // Act
      const me = await request(app.getHttpServer())
        .get('/__private/me')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(me.status).toBe(200);
      expect((me.body as { role: string }).role).toBe('USER');
    });
  });

  describe('SEC-API-02 · wrong credentials', () => {
    it('should_answer_401_invalid_credentials_when_the_password_is_wrong', async () => {
      // Act
      const response = await login({ email: ACCOUNT.email, password: 'another long passphrase' });

      // Assert
      expect(response.status).toBe(401);
      expect((response.body as ProblemBody).code).toBe('invalid-credentials');
      expect(response.headers['www-authenticate']).toBe('Bearer');
    });

    it('should_answer_the_same_when_the_email_does_not_exist_as_when_the_password_is_wrong', async () => {
      // Arrange
      const wrongPassword = await login({
        email: ACCOUNT.email,
        password: 'another long passphrase',
      });

      // Act
      const unknownEmail = await login({
        email: 'nobody@example.com',
        password: 'another long passphrase',
      });

      // Assert: same status, same headers, same body (only `instance`, the id of the request, differs)
      expect(unknownEmail.status).toBe(wrongPassword.status);
      expect(unknownEmail.headers['www-authenticate']).toBe(
        wrongPassword.headers['www-authenticate'],
      );
      expect(unknownEmail.headers['content-type']).toBe(wrongPassword.headers['content-type']);
      const strip = (body: ProblemBody) => ({ ...body, instance: undefined });
      expect(strip(unknownEmail.body as ProblemBody)).toEqual(
        strip(wrongPassword.body as ProblemBody),
      );
    });

    it('should_not_say_whether_the_email_exists_when_the_credentials_are_wrong', async () => {
      // Act
      const response = await login({ email: 'nobody@example.com', password: ACCOUNT.password });

      // Assert
      expect(response.text).not.toContain('nobody@example.com');
      expect(response.text.toLowerCase()).not.toContain('exist');
      expect(response.text).not.toContain(ACCOUNT.password);
    });
  });

  describe('invalid data', () => {
    it.each([
      [{ password: ACCOUNT.password }, '/email'],
      [{ email: ACCOUNT.email }, '/password'],
      [{ email: 'not-an-email', password: ACCOUNT.password }, '/email'],
      [{ email: ACCOUNT.email, password: '' }, '/password'],
      [{ email: ACCOUNT.email, password: 'x'.repeat(129) }, '/password'],
      [{ email: ACCOUNT.email, password: ACCOUNT.password, role: 'ADMIN' }, '/role'],
    ])('should_answer_400_with_the_field_when_the_body_is_invalid (%#)', async (body, pointer) => {
      // Act
      const response = await login(body);

      // Assert
      expect(response.status).toBe(400);
      const pointers = ((response.body as ProblemBody).errors ?? []).map((e) => e.pointer);
      expect(pointers).toContain(pointer);
    });

    it('should_not_repeat_the_password_when_the_body_is_invalid', async () => {
      // Act
      const response = await login({ email: 'not-an-email', password: ACCOUNT.password });

      // Assert
      expect(response.text).not.toContain(ACCOUNT.password);
    });
  });
});
