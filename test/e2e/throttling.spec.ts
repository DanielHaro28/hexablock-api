import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createContractChecker } from '../support/contract.js';
import { createTestApp } from '../support/test-app.js';

let contract: Awaited<ReturnType<typeof createContractChecker>>;

beforeAll(async () => {
  contract = await createContractChecker();
});

describe('SEC-API-04 · rate limiting by IP (limits are low in the test, tests.md)', () => {
  describe('the strict limit of /v1/auth/*', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      app = await createTestApp({ env: { THROTTLE_AUTH_LIMIT: '2', THROTTLE_LIMIT: '1000' } });
    });

    afterAll(async () => {
      await app.close();
    });

    it('should_answer_429_with_retry_after_when_login_attempts_exceed_the_limit', async () => {
      // Arrange
      const server = app.getHttpServer();
      await request(server).post('/v1/auth/login').send({});
      await request(server).post('/v1/auth/login').send({});

      // Act
      const response = await request(server).post('/v1/auth/login').send({});

      // Assert
      expect(response.status).toBe(429);
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(Number(response.headers['retry-after'])).toBeGreaterThanOrEqual(1);
      expect((response.body as { code: string }).code).toBe('too-many-requests');
      expect(
        contract.check('post', '/v1/auth/login', {
          status: response.status,
          headers: response.headers,
          body: response.body,
        }),
      ).toEqual([]);
    });

    it('should_not_apply_the_auth_limit_to_other_routes_when_the_auth_limit_is_reached', async () => {
      // Arrange
      const server = app.getHttpServer();

      // Act
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => request(server).get('/health')),
      );

      // Assert
      expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200]);
    });
  });

  describe('the strict limit when the path changes case', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      app = await createTestApp({ env: { THROTTLE_AUTH_LIMIT: '2', THROTTLE_LIMIT: '1000' } });
    });

    afterAll(async () => {
      await app.close();
    });

    it('should_apply_the_auth_limit_when_the_path_changes_case', async () => {
      // Arrange: Express routes `/V1/AUTH/login` to login; the global limit is 1000, so only the strict limit
      // (2 per minute) can answer 429 here.
      const server = app.getHttpServer();
      const statuses: number[] = [];

      // Act
      for (let attempt = 0; attempt < 3; attempt++) {
        statuses.push((await request(server).post('/V1/AUTH/login').send({})).status);
      }

      // Assert
      expect(statuses).toEqual([200, 200, 429]);
    });
  });

  describe('the global limit', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      app = await createTestApp({ env: { THROTTLE_LIMIT: '2', THROTTLE_AUTH_LIMIT: '1000' } });
    });

    afterAll(async () => {
      await app.close();
    });

    it('should_answer_429_when_any_route_exceeds_the_global_limit', async () => {
      // Arrange
      const server = app.getHttpServer();
      await request(server).get('/health');
      await request(server).get('/health');

      // Act
      const response = await request(server).get('/health');

      // Assert
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });
  });
});
