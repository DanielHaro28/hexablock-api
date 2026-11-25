import { ConflictError } from '../../src/common/domain/domain-error.js';
import type {
  ILevelRepository,
  LevelChange,
  LevelChangesQuery,
  ValidatedLevel,
} from '../../src/modules/levels/application/level-repository.js';

/**
 * Hand-written fake of `ILevelRepository` (D-56): it keeps the changes of the download in memory, records the
 * queries, and keeps what the administrator publishes in `published`.
 */
export class InMemoryLevelRepository implements ILevelRepository {
  readonly queries: LevelChangesQuery[] = [];
  readonly published = new Map<string, ValidatedLevel>();

  constructor(
    private readonly changes: readonly (LevelChange & { gameId: string; topology: string })[] = [],
  ) {}

  listChangedAfter(query: LevelChangesQuery): Promise<LevelChange[]> {
    this.queries.push(query);
    return Promise.resolve(
      this.changes
        .filter(
          (change) =>
            change.gameId === query.gameId &&
            (query.topologies as readonly string[]).includes(change.topology) &&
            change.changeSeq > query.afterSeq,
        )
        .sort((a, b) => (a.changeSeq < b.changeSeq ? -1 : 1))
        .slice(0, query.limit)
        .map(({ changeSeq, level }) => ({ changeSeq, level })),
    );
  }

  findVersion(id: string): Promise<number | undefined> {
    return Promise.resolve(this.published.get(id)?.version);
  }

  create(level: ValidatedLevel): Promise<void> {
    if (this.published.has(level.id)) return Promise.reject(new ConflictError('level-exists'));
    this.published.set(level.id, level);
    return Promise.resolve();
  }

  /**
   * Stores the level without checking the version: that rule belongs to `UpsertLevelUseCase`, and the real
   * adapter also guards it against concurrent requests (tested with PostgreSQL). A fake that repeated the rule
   * would hide a use case that forgot it.
   */
  update(level: ValidatedLevel): Promise<void> {
    this.published.set(level.id, level);
    return Promise.resolve();
  }
}
