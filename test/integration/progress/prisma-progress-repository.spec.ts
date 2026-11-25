import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { AppConfig } from '../../../src/common/config/app-config.js';
import type { GameProgress } from '../../../src/modules/progress/domain/progress.js';
import { PrismaProgressRepository } from '../../../src/modules/progress/infrastructure/prisma-progress-repository.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { truncateAll } from '../../support/test-database.js';

const prisma = new PrismaService({ databaseUrl: process.env.DATABASE_URL ?? '' } as AppConfig);
const repository = new PrismaProgressRepository(prisma);

const FIT: GameProgress = {
  gameId: 'hexa-fit',
  sections: {
    hex: {
      kind: 'levels',
      levels: {
        'fit-hex-001': { stars: 3, timeMs: 38000, moves: 3, achievedAt: '2026-11-09T20:00:00Z' },
      },
    },
  },
};
const LINES: GameProgress = {
  gameId: 'hexa-lines',
  sections: {
    hex: { kind: 'highScore', best: { score: 1240, achievedAt: '2026-11-12T18:30:00Z' } },
  },
};

async function createUser(email: string, displayName: string): Promise<string> {
  const user = await prisma.user.create({ data: { email, displayName, passwordHash: 'stub' } });
  return user.id;
}

async function store(userId: string, progress: GameProgress): Promise<void> {
  await prisma.progress.create({
    data: { userId, gameId: progress.gameId, sections: progress.sections as object },
  });
}

describe('RN-COM-90 · PrismaProgressRepository, reading (PostgreSQL)', () => {
  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should_return_the_progress_of_every_variant_ordered_by_variant_when_the_user_has_several', async () => {
    // Arrange
    const userId = await createUser('ana@example.com', 'AnaP');
    await store(userId, LINES);
    await store(userId, FIT);

    // Act
    const games = await repository.findAllOf(userId);

    // Assert
    expect(games).toEqual([FIT, LINES]);
  });

  it('should_return_an_empty_list_when_the_user_has_no_progress', async () => {
    // Arrange
    const userId = await createUser('ana@example.com', 'AnaP');

    // Act
    const games = await repository.findAllOf(userId);

    // Assert
    expect(games).toEqual([]);
  });

  it('should_not_return_the_progress_of_another_user_when_two_users_have_progress (SEC-API-01)', async () => {
    // Arrange
    const ana = await createUser('ana@example.com', 'AnaP');
    const luis = await createUser('luis@example.com', 'Luis');
    await store(ana, FIT);
    await store(luis, LINES);

    // Act
    const games = await repository.findAllOf(ana);

    // Assert
    expect(games).toEqual([FIT]);
  });
});
