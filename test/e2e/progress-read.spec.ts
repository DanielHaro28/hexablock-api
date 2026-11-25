import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { PrismaClient } from '../../src/prisma/generated/client.js';
import { createContractChecker } from '../support/contract.js';
import { createTestApp } from '../support/test-app.js';
import { createTestPrisma, truncateAll } from '../support/test-database.js';

const ANA = {
  email: 'ana@example.com',
  password: 'a long passphrase of mine',
  displayName: 'AnaP',
};
const LUIS = {
  email: 'luis@example.com',
  password: 'another long passphrase',
  displayName: 'Luis',
};

const FIT_SECTIONS = {
  hex: {
    kind: 'levels',
    levels: {
      'fit-hex-001': { stars: 3, timeMs: 38000, moves: 3, achievedAt: '2026-11-09T20:00:00Z' },
    },
  },
};
const LINES_SECTIONS = {
  hex: { kind: 'highScore', best: { score: 1240, achievedAt: '2026-11-12T18:30:00Z' } },
  square: { kind: 'highScore', best: { score: 860, achievedAt: '2026-11-13T09:15:00Z' } },
};

let contract: Awaited<ReturnType<typeof createContractChecker>>;
let prisma: PrismaClient;

beforeAll(async () => {
  contract = await createContractChecker();
  prisma = createTestPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('RN-COM-90 · GET /v1/me/progress (PostgreSQL)', () => {
  let app: NestExpressApplication;
  let anaId: string;
  let anaToken: string;
  let luisToken: string;

  async function register(account: typeof ANA): Promise<{ id: string; token: string }> {
    const response = await request(app.getHttpServer()).post('/v1/auth/register').send(account);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: account.email } });
    return { id: user.id, token: (response.body as { accessToken: string }).accessToken };
  }

  /** `GET /v1/me/progress`, checked against the contract. */
  async function getProgress(token?: string) {
    const call = request(app.getHttpServer()).get('/v1/me/progress');
    const response = await (token === undefined
      ? call
      : call.set('Authorization', `Bearer ${token}`));
    expect(
      contract.check('get', '/v1/me/progress', {
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
    const ana = await register(ANA);
    anaId = ana.id;
    anaToken = ana.token;
    luisToken = (await register(LUIS)).token;
  });

  it('should_answer_200_with_the_progress_of_every_variant_and_topology_when_the_user_has_it', async () => {
    // Arrange
    await prisma.progress.createMany({
      data: [
        { userId: anaId, gameId: 'hexa-lines', sections: LINES_SECTIONS },
        { userId: anaId, gameId: 'hexa-fit', sections: FIT_SECTIONS },
      ],
    });

    // Act
    const response = await getProgress(anaToken);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      games: [
        { gameId: 'hexa-fit', sections: FIT_SECTIONS },
        { gameId: 'hexa-lines', sections: LINES_SECTIONS },
      ],
    });
  });

  it('should_answer_200_with_an_empty_list_when_the_user_has_no_progress', async () => {
    // Act
    const response = await getProgress(anaToken);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ games: [] });
  });

  describe('SEC-API-01 · only the progress of the user of the token', () => {
    it('should_not_show_the_progress_of_another_user_when_both_have_progress', async () => {
      // Arrange
      await prisma.progress.create({
        data: { userId: anaId, gameId: 'hexa-fit', sections: FIT_SECTIONS },
      });

      // Act
      const luis = await getProgress(luisToken);
      const ana = await getProgress(anaToken);

      // Assert
      expect((luis.body as { games: unknown[] }).games).toEqual([]);
      expect((ana.body as { games: unknown[] }).games).toHaveLength(1);
    });

    it('should_ignore_a_user_id_in_the_query_when_it_names_another_user', async () => {
      // Arrange
      await prisma.progress.create({
        data: { userId: anaId, gameId: 'hexa-fit', sections: FIT_SECTIONS },
      });

      // Act: Luis asks for the progress of Ana by putting her id in the query
      const response = await request(app.getHttpServer())
        .get(`/v1/me/progress?userId=${anaId}`)
        .set('Authorization', `Bearer ${luisToken}`);

      // Assert: the id of the query is not read; Luis gets his own (empty) progress, not the one of Ana
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ games: [] });
      expect(response.text).not.toContain('fit-hex-001');
    });

    it('should_answer_401_when_there_is_no_token', async () => {
      // Act
      const response = await getProgress();

      // Assert
      expect(response.status).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer');
    });
  });
});
