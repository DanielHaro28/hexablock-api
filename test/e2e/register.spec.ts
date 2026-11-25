import type { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { PrismaClient } from '../../src/prisma/generated/client.js';
import { createContractChecker } from '../support/contract.js';
import { createTestApp } from '../support/test-app.js';
import { createTestPrisma, truncateAll } from '../support/test-database.js';

const JWT_SECRET = 'a-test-secret-with-more-than-32-bytes-0123456789';
const VALID = {
  email: 'ana@example.com',
  password: 'a long passphrase of mine',
  displayName: 'AnaP',
} as const;

interface ProblemBody {
  code: string;
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

describe('API-01 · POST /v1/auth/register (PostgreSQL)', () => {
  let app: NestExpressApplication;

  /** Sends a body, checks the answer against the contract and returns it. */
  async function register(body: unknown) {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(body as object);
    expect(
      contract.check('post', '/v1/auth/register', {
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
  });

  describe('a new account', () => {
    it('should_answer_201_with_a_token_when_the_email_is_new_and_the_data_is_valid', async () => {
      // Act
      const response = await register(VALID);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        accessToken: expect.any(String) as unknown as string,
        tokenType: 'Bearer',
        expiresIn: 86_400,
        displayName: 'AnaP',
      });
    });

    it('should_issue_a_token_of_the_new_user_when_the_account_is_created', async () => {
      // Act
      const response = await register(VALID);

      // Assert
      const stored = await prisma.user.findUniqueOrThrow({ where: { email: VALID.email } });
      const payload = await new JwtService({ secret: JWT_SECRET }).verifyAsync<{
        sub: string;
        role: string;
      }>((response.body as { accessToken: string }).accessToken, { algorithms: ['HS256'] });
      expect(payload).toMatchObject({ sub: stored.id, role: 'USER' });
    });

    it('should_store_an_argon2id_hash_and_never_the_password_when_the_account_is_created', async () => {
      // Act
      await register(VALID);

      // Assert
      const stored = await prisma.user.findUniqueOrThrow({ where: { email: VALID.email } });
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
      expect(stored.passwordHash).not.toContain(VALID.password);
    });

    it('should_store_the_email_in_lower_case_and_the_user_role_when_the_account_is_created', async () => {
      // Act
      await register({ ...VALID, email: 'Ana@Example.COM' });

      // Assert
      const stored = await prisma.user.findFirstOrThrow();
      expect(stored.email).toBe('ana@example.com');
      expect(stored.role).toBe('USER');
    });

    it('should_not_return_the_email_or_the_hash_when_the_account_is_created', async () => {
      // Act
      const response = await register(VALID);

      // Assert
      expect(JSON.stringify(response.body)).not.toContain(VALID.email);
      expect(JSON.stringify(response.body)).not.toContain('argon2');
      expect(Object.keys(response.body as object).sort()).toEqual([
        'accessToken',
        'displayName',
        'expiresIn',
        'tokenType',
      ]);
    });

    it('should_accept_spaces_and_unicode_when_the_password_is_long_enough', async () => {
      // Arrange: 18 characters with spaces, accents and an emoji
      const password = 'contraseña ñandú 😀';

      // Act
      const response = await register({ ...VALID, password });

      // Assert
      expect(response.status).toBe(201);
    });
  });

  describe('409 · the email or the display name is taken', () => {
    it('should_answer_409_email_taken_when_the_email_exists_with_other_capitals (D-03)', async () => {
      // Arrange
      await register(VALID);

      // Act
      const response = await register({ ...VALID, email: 'ANA@example.com', displayName: 'Other' });

      // Assert
      expect(response.status).toBe(409);
      expect((response.body as ProblemBody).code).toBe('email-taken');
    });

    it('should_answer_409_display_name_taken_when_the_name_exists_with_other_capitals (RN-COM-109)', async () => {
      // Arrange
      await register(VALID);

      // Act
      const response = await register({
        ...VALID,
        email: 'other@example.com',
        displayName: 'ANAp',
      });

      // Assert
      expect(response.status).toBe(409);
      expect((response.body as ProblemBody).code).toBe('display-name-taken');
    });

    it('should_keep_one_account_when_the_second_registration_is_rejected', async () => {
      // Arrange
      await register(VALID);

      // Act
      await register({ ...VALID, displayName: 'Other' });

      // Assert
      expect(await prisma.user.count()).toBe(1);
    });
  });

  describe('SEC-API-03 · invalid data and fields that are not allowed', () => {
    it('should_answer_400_and_create_nothing_when_the_body_has_a_role', async () => {
      // Act
      const response = await register({ ...VALID, role: 'ADMIN' });

      // Assert
      expect(response.status).toBe(400);
      expect((response.body as ProblemBody).errors).toEqual([
        { pointer: '/role', code: 'not-allowed' },
      ]);
      expect(await prisma.user.count()).toBe(0);
    });

    it.each([
      [{ ...VALID, email: 'not-an-email' }, '/email', 'invalid-email'],
      [{ ...VALID, email: `${'a'.repeat(250)}@example.com` }, '/email', 'too-long'],
      [{ ...VALID, displayName: 'ab' }, '/displayName', 'too-short'],
      [{ ...VALID, displayName: 'a'.repeat(21) }, '/displayName', 'too-long'],
      [{ ...VALID, displayName: ' Ana ' }, '/displayName', 'invalid-format'],
      [{ ...VALID, displayName: 'Ana<script>' }, '/displayName', 'invalid-format'],
    ])(
      'should_answer_400_with_the_field_and_its_code_when_the_data_is_invalid (%#)',
      async (body, pointer, code) => {
        // Act
        const response = await register(body);

        // Assert
        expect(response.status).toBe(400);
        expect((response.body as ProblemBody).errors).toContainEqual({ pointer, code });
      },
    );

    it('should_answer_400_for_each_missing_field_when_the_body_is_empty', async () => {
      // Act
      const response = await register({});

      // Assert
      expect(response.status).toBe(400);
      const pointers = ((response.body as ProblemBody).errors ?? []).map((e) => e.pointer);
      expect(new Set(pointers)).toEqual(new Set(['/email', '/password', '/displayName']));
    });
  });

  describe('SEC-API-02 · password rules (D-52)', () => {
    it.each([
      ['a'.repeat(14), 'too-short'],
      ['a'.repeat(129), 'too-long'],
      ['1q2w3e4r5t6y7u8i9o0p', 'too-common'],
    ])(
      'should_answer_400_in_password_and_create_nothing_when_the_password_breaks_a_rule (%#)',
      async (password, code) => {
        // Act
        const response = await register({ ...VALID, password });

        // Assert
        expect(response.status).toBe(400);
        expect((response.body as ProblemBody).errors).toEqual([{ pointer: '/password', code }]);
        expect(await prisma.user.count()).toBe(0);
      },
    );

    it('should_not_repeat_the_password_when_the_answer_is_a_400', async () => {
      // Arrange
      const password = 'tiny-secret';

      // Act
      const response = await register({ ...VALID, password });

      // Assert
      expect(response.status).toBe(400);
      expect(response.text).not.toContain(password);
    });
  });
});

describe('SEC-API-04 · POST /v1/auth/register is limited to 5 attempts per minute', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp({ database: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should_answer_429_with_retry_after_when_the_sixth_attempt_comes_in_the_same_minute', async () => {
    // Arrange: five attempts that fail validation, which is cheap and still counts
    const server = app.getHttpServer();
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect((await request(server).post('/v1/auth/register').send({})).status).toBe(400);
    }

    // Act
    const response = await request(server).post('/v1/auth/register').send({});

    // Assert
    expect(response.status).toBe(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(
      contract.check('post', '/v1/auth/register', {
        status: response.status,
        headers: response.headers,
        body: response.body,
      }),
    ).toEqual([]);
  });
});
