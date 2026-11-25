import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { AppConfig } from '../../../src/common/config/app-config.js';
import type { BestAttemptRecord } from '../../../src/modules/progress/application/transaction-runner.js';
import type { GameProgress } from '../../../src/modules/progress/domain/progress.js';
import { PrismaTransactionRunner } from '../../../src/modules/progress/infrastructure/prisma-transaction-runner.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { truncateAll } from '../../support/test-database.js';

const prisma = new PrismaService({ databaseUrl: process.env.DATABASE_URL ?? '' } as AppConfig);
const runner = new PrismaTransactionRunner(prisma);

function fit(...levels: string[]): GameProgress {
  return {
    gameId: 'hexa-fit',
    sections: {
      hex: {
        kind: 'levels',
        levels: Object.fromEntries(
          levels.map((id) => [
            id,
            { stars: 3, timeMs: 1000, moves: 3, achievedAt: '2026-11-10T14:00:00Z' },
          ]),
        ),
      },
    },
  };
}

const ATTEMPT: BestAttemptRecord = {
  gameId: 'hexa-fit',
  topology: 'hex',
  levelId: 'fit-hex-001',
  stars: 3,
  timeMs: 1000,
  moves: 3,
  achievedAt: '2026-11-10T14:00:00Z',
};

async function createUser(email: string, displayName: string): Promise<string> {
  return (await prisma.user.create({ data: { email, displayName, passwordHash: 'stub' } })).id;
}

describe('ARQ-04-API §3 · PrismaTransactionRunner (PostgreSQL)', () => {
  let userId: string;

  beforeEach(async () => {
    await truncateAll(prisma);
    userId = await createUser('ana@example.com', 'AnaP');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should_lock_a_row_that_does_not_exist_yet_and_answer_nothing_when_the_user_has_no_progress', async () => {
    // Act
    const stored = await runner.run((unit) => unit.lockProgress(userId, 'hexa-fit'));

    // Assert
    expect(stored).toBeUndefined();
  });

  it('should_store_the_progress_and_read_it_back_when_the_work_ends_well', async () => {
    // Act
    await runner.run(async (unit) => {
      await unit.lockProgress(userId, 'hexa-fit');
      await unit.saveProgress(userId, fit('fit-hex-001'));
    });
    const stored = await runner.run((unit) => unit.lockProgress(userId, 'hexa-fit'));

    // Assert
    expect(stored).toEqual(fit('fit-hex-001'));
  });

  it('should_replace_the_stored_progress_when_it_is_saved_again', async () => {
    // Arrange
    await runner.run(async (unit) => {
      await unit.lockProgress(userId, 'hexa-fit');
      await unit.saveProgress(userId, fit('fit-hex-001'));
    });

    // Act
    await runner.run(async (unit) => {
      await unit.lockProgress(userId, 'hexa-fit');
      await unit.saveProgress(userId, fit('fit-hex-001', 'fit-hex-002'));
    });

    // Assert
    expect(await prisma.progress.count()).toBe(1);
    const stored = await runner.run((unit) => unit.lockProgress(userId, 'hexa-fit'));
    expect(Object.keys((stored?.sections['hex'] as { levels: object }).levels)).toEqual([
      'fit-hex-001',
      'fit-hex-002',
    ]);
  });

  it('should_store_nothing_when_the_work_fails_after_saving', async () => {
    // Act
    const attempt = runner.run(async (unit) => {
      await unit.lockProgress(userId, 'hexa-fit');
      await unit.saveProgress(userId, fit('fit-hex-001'));
      await unit.saveBestAttempts(userId, [ATTEMPT]);
      throw new Error('the work failed');
    });

    // Assert: neither the progress nor the best attempt nor the row that the lock created stays
    await expect(attempt).rejects.toThrow('the work failed');
    expect(await prisma.progress.count()).toBe(0);
    expect(await prisma.bestAttempt.count()).toBe(0);
  });

  describe('best attempts', () => {
    it('should_store_one_row_per_user_variant_topology_and_level_when_attempts_are_saved', async () => {
      // Act
      await runner.run((unit) =>
        unit.saveBestAttempts(userId, [ATTEMPT, { ...ATTEMPT, levelId: 'fit-hex-002', stars: 2 }]),
      );

      // Assert
      const rows = await prisma.bestAttempt.findMany({ orderBy: { levelId: 'asc' } });
      expect(rows.map((row) => [row.levelId, row.stars, row.score])).toEqual([
        ['fit-hex-001', 3, null],
        ['fit-hex-002', 2, null],
      ]);
    });

    it('should_replace_the_row_and_not_add_one_when_the_same_level_is_saved_again', async () => {
      // Arrange
      await runner.run((unit) => unit.saveBestAttempts(userId, [ATTEMPT]));

      // Act
      await runner.run((unit) =>
        unit.saveBestAttempts(userId, [{ ...ATTEMPT, stars: 1, moves: 9 }]),
      );

      // Assert
      const rows = await prisma.bestAttempt.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ stars: 1, moves: 9 });
    });

    it('should_store_a_record_with_an_empty_level_id_and_a_score_when_the_variant_has_no_levels', async () => {
      // Act
      await runner.run((unit) =>
        unit.saveBestAttempts(userId, [
          {
            gameId: 'hexa-lines',
            topology: 'hex',
            levelId: '',
            score: 1240,
            achievedAt: '2026-11-12T18:30:00Z',
          },
        ]),
      );

      // Assert
      const row = await prisma.bestAttempt.findFirstOrThrow();
      expect(row).toMatchObject({ levelId: '', score: 1240, stars: null, moves: null });
      expect(row.achievedAt.toISOString()).toBe('2026-11-12T18:30:00.000Z');
    });

    it('should_keep_the_rows_of_two_users_apart_when_both_save_the_same_level', async () => {
      // Arrange
      const luis = await createUser('luis@example.com', 'Luis');

      // Act
      await runner.run((unit) => unit.saveBestAttempts(userId, [ATTEMPT]));
      await runner.run((unit) => unit.saveBestAttempts(luis, [{ ...ATTEMPT, stars: 1 }]));

      // Assert
      expect(await prisma.bestAttempt.count()).toBe(2);
    });
  });

  describe('the lock of the row (FOR UPDATE)', () => {
    it('should_not_lose_any_level_when_several_syncs_of_the_same_user_run_at_once', async () => {
      // Arrange: eight syncs of the same user and variant, each adding a different level. Without the lock each
      // one reads the same stored progress and the last one to write erases the others
      const ids = Array.from({ length: 8 }, (_, index) => `fit-hex-00${index + 1}`);

      // Act
      await Promise.all(
        ids.map((id) =>
          runner.run(async (unit) => {
            const stored = (await unit.lockProgress(userId, 'hexa-fit')) ?? fit();
            const levels = (stored.sections['hex'] as { levels: object } | undefined)?.levels ?? {};
            await unit.saveProgress(userId, fit(...Object.keys(levels), id));
          }),
        ),
      );

      // Assert
      const stored = await runner.run((unit) => unit.lockProgress(userId, 'hexa-fit'));
      expect(Object.keys((stored?.sections['hex'] as { levels: object }).levels).sort()).toEqual(
        ids,
      );
    });

    it('should_not_fail_when_two_first_syncs_of_a_new_user_arrive_at_once', async () => {
      // Act: no row exists, so there is nothing to lock until it is created without a clash
      const results = await Promise.allSettled([
        runner.run((unit) => unit.lockProgress(userId, 'hexa-sort')),
        runner.run((unit) => unit.lockProgress(userId, 'hexa-sort')),
      ]);

      // Assert
      expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
    });
  });
});
