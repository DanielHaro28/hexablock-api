import type { IProgressRepository } from '../../src/modules/progress/application/progress-repository.js';
import type { GameProgress } from '../../src/modules/progress/domain/progress.js';

/** Hand-written fake of `IProgressRepository` (D-56): the progress of each user in memory. */
export class InMemoryProgressRepository implements IProgressRepository {
  readonly queriedFor: string[] = [];

  constructor(private readonly byUser: ReadonlyMap<string, readonly GameProgress[]> = new Map()) {}

  findAllOf(userId: string): Promise<GameProgress[]> {
    this.queriedFor.push(userId);
    return Promise.resolve(
      [...(this.byUser.get(userId) ?? [])].sort((a, b) => a.gameId.localeCompare(b.gameId)),
    );
  }
}
