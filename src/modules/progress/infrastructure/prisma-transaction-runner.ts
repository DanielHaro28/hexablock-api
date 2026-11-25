import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  BestAttemptRecord,
  ITransactionRunner,
  ProgressUnitOfWork,
} from '../application/transaction-runner.js';
import type { GameId, GameProgress, Section } from '../domain/progress.js';

/**
 * Adapter of `ITransactionRunner`: a PostgreSQL transaction (ARQ-04-API §3). Everything the work saves is
 * committed together when it ends well, and rolled back when it throws.
 */
@Injectable()
export class PrismaTransactionRunner implements ITransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (unit: ProgressUnitOfWork) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(unitOfWork(tx)));
  }
}

function unitOfWork(tx: Prisma.TransactionClient): ProgressUnitOfWork {
  return {
    async lockProgress(userId: string, gameId: GameId): Promise<GameProgress | undefined> {
      // `FOR UPDATE` cannot lock a row that does not exist, so two first syncs of a user would both see nothing and
      // the second would fail on the primary key. The row is created empty first (a no-op when it exists); it
      // disappears with the transaction if the sync fails, and an empty row means "no progress yet".
      await tx.$executeRaw`
        INSERT INTO progress (user_id, game_id, sections, updated_at)
        VALUES (${userId}::uuid, ${gameId}, '{}'::jsonb, now())
        ON CONFLICT (user_id, game_id) DO NOTHING`;
      const rows = await tx.$queryRaw<{ sections: Record<string, Section> }[]>`
        SELECT sections FROM progress
        WHERE user_id = ${userId}::uuid AND game_id = ${gameId}
        FOR UPDATE`;

      const sections = rows[0]?.sections ?? {};
      return Object.keys(sections).length === 0 ? undefined : { gameId, sections };
    },

    async saveProgress(userId: string, progress: GameProgress): Promise<void> {
      const sections = progress.sections as unknown as Prisma.InputJsonObject;
      await tx.progress.upsert({
        where: { userId_gameId: { userId, gameId: progress.gameId } },
        create: { userId, gameId: progress.gameId, sections },
        update: { sections },
      });
    },

    async saveBestAttempts(userId: string, attempts: readonly BestAttemptRecord[]): Promise<void> {
      for (const attempt of attempts) {
        const columns = {
          stars: attempt.stars ?? null,
          timeMs: attempt.timeMs ?? null,
          moves: attempt.moves ?? null,
          score: attempt.score ?? null,
          achievedAt: new Date(attempt.achievedAt),
        };
        await tx.bestAttempt.upsert({
          where: {
            userId_gameId_topology_levelId: {
              userId,
              gameId: attempt.gameId,
              topology: attempt.topology,
              levelId: attempt.levelId,
            },
          },
          create: {
            userId,
            gameId: attempt.gameId,
            topology: attempt.topology,
            levelId: attempt.levelId,
            ...columns,
          },
          update: columns,
        });
      }
    },
  };
}
