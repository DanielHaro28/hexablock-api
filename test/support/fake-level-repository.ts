import type {
  ILevelRepository,
  LevelChange,
  LevelChangesQuery,
} from '../../src/modules/levels/application/level-repository.js';

/** Hand-written fake of `ILevelRepository` (D-56): it keeps the changes in memory and records the queries. */
export class InMemoryLevelRepository implements ILevelRepository {
  readonly queries: LevelChangesQuery[] = [];

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
}
