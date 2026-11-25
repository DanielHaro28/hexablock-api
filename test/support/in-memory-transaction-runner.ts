import type {
  BestAttemptRecord,
  ITransactionRunner,
  ProgressUnitOfWork,
} from '../../src/modules/progress/application/transaction-runner.js';
import type { GameId, GameProgress } from '../../src/modules/progress/domain/progress.js';

/**
 * Hand-written fake of `ITransactionRunner` (D-56). The work runs on a copy of the data that replaces the real
 * one only if the work finishes without an error, like a database that rolls back.
 */
export class InMemoryTransactionRunner implements ITransactionRunner {
  readonly progress = new Map<string, GameProgress>();
  readonly bestAttempts: { userId: string; attempt: BestAttemptRecord }[] = [];
  readonly locked: { userId: string; gameId: GameId }[] = [];
  runs = 0;

  async run<T>(work: (unit: ProgressUnitOfWork) => Promise<T>): Promise<T> {
    this.runs++;
    const progress = new Map(structuredClone([...this.progress]));
    const bestAttempts = structuredClone(this.bestAttempts);

    const unit: ProgressUnitOfWork = {
      lockProgress: (userId, gameId) => {
        this.locked.push({ userId, gameId });
        return Promise.resolve(structuredClone(progress.get(`${userId}|${gameId}`)));
      },
      saveProgress: (userId, game) => {
        progress.set(`${userId}|${game.gameId}`, structuredClone(game));
        return Promise.resolve();
      },
      saveBestAttempts: (userId, attempts) => {
        for (const attempt of attempts) {
          const index = bestAttempts.findIndex(
            (stored) =>
              stored.userId === userId &&
              stored.attempt.gameId === attempt.gameId &&
              stored.attempt.topology === attempt.topology &&
              stored.attempt.levelId === attempt.levelId,
          );
          if (index >= 0) bestAttempts[index] = { userId, attempt: structuredClone(attempt) };
          else bestAttempts.push({ userId, attempt: structuredClone(attempt) });
        }
        return Promise.resolve();
      },
    };

    const result = await work(unit);
    this.progress.clear();
    for (const [key, value] of progress) this.progress.set(key, value);
    this.bestAttempts.splice(0, this.bestAttempts.length, ...bestAttempts);
    return result;
  }
}
