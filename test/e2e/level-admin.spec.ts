import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { Argon2PasswordHasher } from '../../src/modules/auth/infrastructure/argon2-password-hasher.js';
import type { PrismaClient } from '../../src/prisma/generated/client.js';
import { createContractChecker } from '../support/contract.js';
import { createTestApp } from '../support/test-app.js';
import { createTestPrisma, truncateAll } from '../support/test-database.js';

const EXAMPLES = resolve(import.meta.dirname, '../../docs/contracts/examples');

type Json = Record<string, unknown>;

/** The level of the shared example E-HF-NIVEL, a fresh copy for each test. */
function fitLevel(version = 1): Json {
  const level = JSON.parse(
    readFileSync(resolve(EXAMPLES, 'E-HF-NIVEL.fit-hex-001.level.json'), 'utf8'),
  ) as Json;
  return { ...level, version };
}

const ADMIN = { email: 'admin@example.com', password: 'an administrator passphrase' };
const PLAYER = {
  email: 'ana@example.com',
  password: 'a long passphrase of mine',
  displayName: 'AnaP',
};

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

describe('LVL-02 · POST /v1/levels and PUT /v1/levels/{id} (PostgreSQL)', () => {
  let app: NestExpressApplication;
  let adminToken: string;
  let playerToken: string;

  async function tokenOf(credentials: { email: string; password: string }): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  }

  /** `POST /v1/levels` as the given caller, checked against the contract. */
  async function publish(body: unknown, token?: string) {
    const call = request(app.getHttpServer()).post('/v1/levels');
    const response = await (
      token === undefined ? call : call.set('Authorization', `Bearer ${token}`)
    ).send(body as object);
    expect(
      contract.check('post', '/v1/levels', {
        status: response.status,
        headers: response.headers,
        body: response.body,
      }),
    ).toEqual([]);
    return response;
  }

  /** `PUT /v1/levels/{id}` as the given caller, checked against the contract. */
  async function update(id: string, body: unknown, token?: string) {
    const call = request(app.getHttpServer()).put(`/v1/levels/${id}`);
    const response = await (
      token === undefined ? call : call.set('Authorization', `Bearer ${token}`)
    ).send(body as object);
    expect(
      contract.check('put', '/v1/levels/{id}', {
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
    // The first administrator comes from the seed (SEC-API-05); here it is created the same way, with a hash
    await prisma.user.create({
      data: {
        email: ADMIN.email,
        displayName: 'Admin',
        role: 'ADMIN',
        passwordHash: await new Argon2PasswordHasher().hash(ADMIN.password),
      },
    });
    await request(app.getHttpServer()).post('/v1/auth/register').send(PLAYER).expect(201);
    adminToken = await tokenOf(ADMIN);
    playerToken = await tokenOf(PLAYER);
  });

  describe('SEC-API-05 · who can publish', () => {
    it('should_answer_403_and_store_nothing_when_the_caller_is_a_player', async () => {
      // Act
      const response = await publish(fitLevel(), playerToken);

      // Assert
      expect(response.status).toBe(403);
      expect((response.body as ProblemBody).code).toBe('forbidden');
      expect(await prisma.level.count()).toBe(0);
    });

    it('should_answer_401_when_there_is_no_token', async () => {
      // Act
      const response = await publish(fitLevel());

      // Assert
      expect(response.status).toBe(401);
    });

    it('should_answer_403_when_a_player_tries_to_update_a_level', async () => {
      // Arrange
      await publish(fitLevel(1), adminToken);

      // Act
      const response = await update('fit-hex-001', fitLevel(2), playerToken);

      // Assert
      expect(response.status).toBe(403);
      expect((await prisma.level.findUniqueOrThrow({ where: { id: 'fit-hex-001' } })).version).toBe(
        1,
      );
    });

    it('should_answer_401_when_there_is_no_token_to_update_a_level', async () => {
      // Act
      const response = await update('fit-hex-001', fitLevel(2));

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('publishing a new level (POST)', () => {
    it('should_answer_201_with_the_level_and_its_location_when_the_administrator_sends_a_valid_level', async () => {
      // Arrange
      const level = fitLevel();

      // Act
      const response = await publish(level, adminToken);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toEqual(level);
      expect(response.headers['location']).toBe('/v1/levels/fit-hex-001');
    });

    it('should_make_the_level_available_in_the_download_when_it_was_published', async () => {
      // Arrange
      await publish(fitLevel(), adminToken);

      // Act
      const response = await request(app.getHttpServer()).get(
        '/v1/levels?gameId=hexa-fit&topology=hex',
      );

      // Assert
      expect((response.body as { levels: Json[] }).levels).toEqual([fitLevel()]);
    });

    it('should_answer_409_level_exists_when_the_id_is_already_published', async () => {
      // Arrange
      await publish(fitLevel(1), adminToken);

      // Act
      const response = await publish(fitLevel(2), adminToken);

      // Assert
      expect(response.status).toBe(409);
      expect((response.body as ProblemBody).code).toBe('level-exists');
    });
  });

  describe('RN-COM-71, 76 · a level that is not valid', () => {
    it('should_answer_400_invalid_level_with_the_field_when_the_level_breaks_the_schema', async () => {
      // Arrange
      const level = fitLevel();
      delete level['name'];

      // Act
      const response = await publish(level, adminToken);

      // Assert
      expect(response.status).toBe(400);
      expect((response.body as ProblemBody).code).toBe('invalid-level');
      expect((response.body as ProblemBody).errors).toContainEqual({
        pointer: '/name',
        code: 'required',
      });
      expect(await prisma.level.count()).toBe(0);
    });

    it('should_answer_400_with_the_rule_when_the_level_breaks_a_structural_rule (RN-HF-12 a)', async () => {
      // Arrange: piece B with 4 cells, the first variation of E-HF-NIVEL
      const level = fitLevel();
      ((level['variant'] as Json)['pieces'] as { shape: unknown[] }[])[1]!.shape.push([1, 1]);

      // Act
      const response = await publish(level, adminToken);

      // Assert
      expect(response.status).toBe(400);
      expect((response.body as ProblemBody).errors).toContainEqual({
        pointer: '/variant/pieces',
        code: 'rn-hf-12-a',
      });
      expect(await prisma.level.count()).toBe(0);
    });

    it('should_answer_400_with_the_rule_when_the_solution_leaves_the_figure (RN-HF-12 d)', async () => {
      // Arrange: the second variation of E-HF-NIVEL
      const level = fitLevel();
      ((level['variant'] as Json)['solution'] as Record<string, unknown[]>)['A'] = [
        [2, -1],
        [2, 0],
        [3, 0],
      ];

      // Act
      const response = await publish(level, adminToken);

      // Assert
      expect((response.body as ProblemBody).errors).toContainEqual({
        pointer: '/variant/solution/A/2',
        code: 'rn-hf-12-d',
      });
    });

    it('should_not_repeat_the_values_the_administrator_sent_when_the_level_is_rejected', async () => {
      // Arrange
      const level = { ...fitLevel(), id: 'SECRET-ID', extra: 'SECRET-EXTRA' };

      // Act
      const response = await publish(level, adminToken);

      // Assert
      expect(response.status).toBe(400);
      expect(response.text).not.toContain('SECRET');
    });

    it('should_answer_400_when_the_body_is_not_a_level', async () => {
      // Act
      const response = await publish({}, adminToken);

      // Assert
      expect(response.status).toBe(400);
      expect((response.body as ProblemBody).code).toBe('invalid-level');
    });
  });

  describe('updating a level (PUT)', () => {
    beforeEach(async () => {
      await publish(fitLevel(1), adminToken);
    });

    it('should_answer_200_with_the_level_and_deliver_it_again_when_the_version_is_higher (RN-COM-77)', async () => {
      // Arrange
      const first = await request(app.getHttpServer()).get(
        '/v1/levels?gameId=hexa-fit&topology=hex',
      );
      const cursor = (first.body as { nextCursor: string }).nextCursor;

      // Act
      const response = await update('fit-hex-001', fitLevel(2), adminToken);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual(fitLevel(2));
      const download = await request(app.getHttpServer()).get(
        `/v1/levels?gameId=hexa-fit&topology=hex&cursor=${cursor}`,
      );
      expect((download.body as { levels: Json[] }).levels).toEqual([fitLevel(2)]);
    });

    it('should_answer_409_stale_version_when_the_version_is_not_higher', async () => {
      // Act
      const response = await update('fit-hex-001', fitLevel(1), adminToken);

      // Assert
      expect(response.status).toBe(409);
      expect((response.body as ProblemBody).code).toBe('stale-version');
    });

    it('should_answer_404_when_no_level_has_the_id_of_the_route', async () => {
      // Arrange
      const level = { ...fitLevel(2), id: 'fit-hex-002' };

      // Act
      const response = await update('fit-hex-002', level, adminToken);

      // Assert
      expect(response.status).toBe(404);
      expect((response.body as ProblemBody).code).toBe('not-found');
    });

    it('should_answer_400_validation_failed_when_the_id_of_the_body_is_not_the_one_of_the_route', async () => {
      // Act
      const response = await update('fit-hex-002', fitLevel(2), adminToken);

      // Assert
      expect(response.status).toBe(400);
      expect((response.body as ProblemBody).code).toBe('validation-failed');
      expect((response.body as ProblemBody).errors).toEqual([
        { pointer: '/id', code: 'id-mismatch' },
      ]);
    });

    it('should_answer_400_invalid_level_when_the_new_version_breaks_a_rule', async () => {
      // Arrange
      const level = fitLevel(2);
      (level['variant'] as { starThresholds: { moves: number } }).starThresholds.moves = 1;

      // Act
      const response = await update('fit-hex-001', level, adminToken);

      // Assert
      expect(response.status).toBe(400);
      expect((response.body as ProblemBody).errors).toContainEqual({
        pointer: '/variant/starThresholds/moves',
        code: 'rn-hf-12-g',
      });
      expect((await prisma.level.findUniqueOrThrow({ where: { id: 'fit-hex-001' } })).version).toBe(
        1,
      );
    });
  });

  describe('RN-COM-73, 74 · levels are never deleted', () => {
    it('should_answer_404_and_keep_the_level_when_an_administrator_tries_to_delete_it', async () => {
      // Arrange
      await publish(fitLevel(), adminToken);

      // Act
      const response = await request(app.getHttpServer())
        .delete('/v1/levels/fit-hex-001')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(404);
      expect(await prisma.level.count()).toBe(1);
    });
  });
});
