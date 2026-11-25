import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { PrismaClient } from '../../src/prisma/generated/client.js';
import { createContractChecker } from '../support/contract.js';
import { createTestApp } from '../support/test-app.js';
import { createTestPrisma, truncateAll } from '../support/test-database.js';

const EXAMPLES = resolve(import.meta.dirname, '../../docs/contracts/examples');

function example(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(EXAMPLES, file), 'utf8')) as Record<string, unknown>;
}

const FIT_HEX_001 = example('E-HF-NIVEL.fit-hex-001.level.json');
const SORT_ANY_001 = example('sort-any-001.level.json');
const SORT_HEX_007 = example('sort-hex-007.level.json');

interface LevelPageBody {
  levels: Record<string, unknown>[];
  nextCursor: string;
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

async function publish(level: Record<string, unknown>): Promise<void> {
  await prisma.level.create({
    data: {
      id: level['id'] as string,
      gameId: level['gameId'] as string,
      topology: level['topology'] as string,
      order: level['order'] as number,
      version: level['version'] as number,
      data: level as object,
    },
  });
}

describe('LVL-01 · GET /v1/levels (PostgreSQL)', () => {
  let app: NestExpressApplication;

  /** Asks for levels, checks the answer against the contract and returns it. */
  async function getLevels(query: string) {
    const response = await request(app.getHttpServer()).get(`/v1/levels?${query}`);
    expect(
      contract.check('get', '/v1/levels', {
        status: response.status,
        headers: response.headers,
        body: response.body,
      }),
    ).toEqual([]);
    return response;
  }

  beforeAll(async () => {
    app = await createTestApp({ database: true, env: { THROTTLE_LIMIT: '1000' } });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  describe('the first page', () => {
    it('should_answer_200_with_the_levels_and_a_cursor_when_there_is_no_cursor', async () => {
      // Arrange
      await publish(FIT_HEX_001);

      // Act
      const response = await getLevels('gameId=hexa-fit&topology=hex');

      // Assert
      const body = response.body as LevelPageBody;
      expect(response.status).toBe(200);
      expect(body.levels).toEqual([FIT_HEX_001]);
      expect(body.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should_carry_the_version_the_topology_and_the_solution_when_a_level_is_delivered', async () => {
      // Arrange
      await publish(FIT_HEX_001);

      // Act
      const body = (await getLevels('gameId=hexa-fit&topology=hex')).body as LevelPageBody;

      // Assert (RN-COM-70, 75, 76: the app validates the solution it receives)
      expect(body.levels[0]).toMatchObject({ version: 1, topology: 'hex' });
      expect(body.levels[0]?.['variant']).toHaveProperty('solution');
    });

    it('should_answer_an_empty_list_and_a_cursor_when_no_level_is_published', async () => {
      // Act
      const response = await getLevels('gameId=hexa-fit&topology=hex');

      // Assert
      expect(response.status).toBe(200);
      expect((response.body as LevelPageBody).levels).toEqual([]);
      expect((response.body as LevelPageBody).nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should_not_need_a_token_when_the_levels_are_requested', async () => {
      // Act
      const response = await request(app.getHttpServer()).get(
        '/v1/levels?gameId=hexa-fit&topology=hex',
      );

      // Assert
      expect(response.status).toBe(200);
    });
  });

  describe('RN-COM-77 · download by changes', () => {
    it('should_answer_an_empty_list_and_the_same_cursor_when_nothing_changed_since_the_cursor', async () => {
      // Arrange
      await publish(FIT_HEX_001);
      const first = (await getLevels('gameId=hexa-fit&topology=hex')).body as LevelPageBody;

      // Act
      const second = (await getLevels(`gameId=hexa-fit&topology=hex&cursor=${first.nextCursor}`))
        .body as LevelPageBody;

      // Assert
      expect(second.levels).toEqual([]);
      expect(second.nextCursor).toBe(first.nextCursor);
    });

    it('should_answer_only_the_new_level_when_one_is_published_after_the_cursor', async () => {
      // Arrange
      await publish(SORT_HEX_007);
      const first = (await getLevels('gameId=hexa-sort&topology=hex')).body as LevelPageBody;
      await publish(SORT_ANY_001);

      // Act
      const second = (await getLevels(`gameId=hexa-sort&topology=hex&cursor=${first.nextCursor}`))
        .body as LevelPageBody;

      // Assert
      expect(second.levels.map((level) => level['id'])).toEqual(['sort-any-001']);
      expect(second.nextCursor).not.toBe(first.nextCursor);
    });

    it('should_answer_the_level_again_when_it_was_updated_after_the_cursor', async () => {
      // Arrange
      await publish(FIT_HEX_001);
      const first = (await getLevels('gameId=hexa-fit&topology=hex')).body as LevelPageBody;
      await prisma.level.update({
        where: { id: 'fit-hex-001' },
        data: { version: 2, data: { ...FIT_HEX_001, version: 2 } },
      });

      // Act
      const second = (await getLevels(`gameId=hexa-fit&topology=hex&cursor=${first.nextCursor}`))
        .body as LevelPageBody;

      // Assert
      expect(second.levels).toHaveLength(1);
      expect(second.levels[0]).toMatchObject({ id: 'fit-hex-001', version: 2 });
    });

    it('should_deliver_every_level_once_when_the_pages_are_followed_with_limit_1', async () => {
      // Arrange
      await publish(SORT_HEX_007);
      await publish(SORT_ANY_001);

      // Act
      const first = (await getLevels('gameId=hexa-sort&topology=hex&limit=1'))
        .body as LevelPageBody;
      const second = (
        await getLevels(`gameId=hexa-sort&topology=hex&limit=1&cursor=${first.nextCursor}`)
      ).body as LevelPageBody;
      const third = (
        await getLevels(`gameId=hexa-sort&topology=hex&limit=1&cursor=${second.nextCursor}`)
      ).body as LevelPageBody;

      // Assert
      expect(first.levels.map((level) => level['id'])).toEqual(['sort-hex-007']);
      expect(second.levels.map((level) => level['id'])).toEqual(['sort-any-001']);
      expect(third.levels).toEqual([]);
    });
  });

  describe('RN-COM-75 · variant and topology', () => {
    it('should_answer_the_levels_of_topology_any_when_a_hexa_sort_topology_is_asked', async () => {
      // Arrange
      await publish(SORT_HEX_007);
      await publish(SORT_ANY_001);
      await publish(FIT_HEX_001);

      // Act
      const body = (await getLevels('gameId=hexa-sort&topology=square')).body as LevelPageBody;

      // Assert: only the level that is valid for any topology
      expect(body.levels.map((level) => level['id'])).toEqual(['sort-any-001']);
    });

    it('should_not_answer_levels_of_another_variant_or_topology_when_hexa_fit_hex_is_asked', async () => {
      // Arrange
      await publish(FIT_HEX_001);
      await publish(SORT_HEX_007);

      // Act
      const body = (await getLevels('gameId=hexa-fit&topology=square')).body as LevelPageBody;

      // Assert
      expect(body.levels).toEqual([]);
    });
  });

  describe('400 · invalid query', () => {
    it.each([
      ['no gameId', 'topology=hex', '/gameId'],
      ['no topology', 'gameId=hexa-fit', '/topology'],
      ['an unknown gameId', 'gameId=hexa-lines&topology=hex', '/gameId'],
      [
        'a topology that levels do not use as a filter (any)',
        'gameId=hexa-sort&topology=any',
        '/topology',
      ],
      ['limit 0', 'gameId=hexa-fit&topology=hex&limit=0', '/limit'],
      ['limit 101', 'gameId=hexa-fit&topology=hex&limit=101', '/limit'],
      ['a limit that is not a number', 'gameId=hexa-fit&topology=hex&limit=abc', '/limit'],
      [
        'a cursor with forbidden characters',
        'gameId=hexa-fit&topology=hex&cursor=a%20b!',
        '/cursor',
      ],
      [
        'a cursor the server did not issue',
        'gameId=hexa-fit&topology=hex&cursor=garbage',
        '/cursor',
      ],
      ['a parameter that does not exist', 'gameId=hexa-fit&topology=hex&order=desc', '/order'],
    ])('should_answer_400_with_the_field_when_the_query_has_%s', async (_label, query, pointer) => {
      // Act
      const response = await getLevels(query);

      // Assert
      expect(response.status).toBe(400);
      const pointers = ((response.body as { errors?: { pointer: string }[] }).errors ?? []).map(
        (error) => error.pointer,
      );
      expect(pointers).toContain(pointer);
    });
  });

  describe('RN-COM-73, 74 · levels are never deleted', () => {
    it('should_answer_404_and_keep_the_level_when_a_delete_is_attempted', async () => {
      // Arrange
      await publish(FIT_HEX_001);

      // Act
      const response = await request(app.getHttpServer()).delete('/v1/levels/fit-hex-001');

      // Assert
      expect(response.status).toBe(404);
      expect(await prisma.level.count()).toBe(1);
    });
  });
});
