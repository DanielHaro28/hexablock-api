import type { GameId, GameProgress } from '../domain/progress.js';

/** A best attempt as it is stored in `best_attempts`: one per user, variant, topology and level (`''` for a record). */
export interface BestAttemptRecord {
  readonly gameId: GameId;
  readonly topology: string;
  /** The level, or the empty string for the record of a variant without levels. */
  readonly levelId: string;
  readonly stars?: number;
  readonly timeMs?: number;
  readonly moves?: number;
  readonly score?: number;
  readonly achievedAt: string;
}

/** What a sync does inside its transaction. Every call uses the same transaction. */
export interface ProgressUnitOfWork {
  /**
   * Locks the row of this user and variant until the transaction ends (`FOR UPDATE`) and returns what is stored,
   * or `undefined` when the user has no progress in the variant yet. Two syncs of the same user wait for each
   * other, so they cannot step on each other (ARQ-04-API §3).
   */
  lockProgress(userId: string, gameId: GameId): Promise<GameProgress | undefined>;

  /** Stores the progress of the variant (creating it or replacing it). */
  saveProgress(userId: string, progress: GameProgress): Promise<void>;

  /** Stores the best attempts, creating or replacing the one of each user, variant, topology and level. */
  saveBestAttempts(userId: string, attempts: readonly BestAttemptRecord[]): Promise<void>;
}

/** Port that runs a piece of work in one transaction: all of it is saved or none of it (ARQ-04-API §3). */
export interface ITransactionRunner {
  run<T>(work: (unit: ProgressUnitOfWork) => Promise<T>): Promise<T>;
}
