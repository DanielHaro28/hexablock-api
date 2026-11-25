import type { GameProgress } from '../domain/progress.js';

/** Port of the stored progress (ARQ-03-API §3). The Prisma adapter lives in `infrastructure/`. */
export interface IProgressRepository {
  /**
   * The progress of every variant that `userId` has, ordered by `gameId`. A user without progress has an empty
   * list. Only this user's rows: the id comes from the JWT (SEC-API-01).
   */
  findAllOf(userId: string): Promise<GameProgress[]>;
}
