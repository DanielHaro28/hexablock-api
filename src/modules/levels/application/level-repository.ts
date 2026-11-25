import type { LevelGameId, LevelTopology } from '../domain/level-topologies.js';

/** A published level exactly as it was validated and stored: the JSON of `level.schema.json`. */
export type LevelDocument = Readonly<Record<string, unknown>>;

/** A level that passed the schema and the structural rules, with the columns the database indexes. */
export interface ValidatedLevel {
  readonly id: string;
  readonly gameId: LevelGameId;
  readonly topology: LevelTopology;
  readonly order: number;
  readonly version: number;
  /** The whole level, as it was received and validated (what is stored in `levels.data`). */
  readonly document: LevelDocument;
}

/** A level and the position of its last change in the download order (`levels.change_seq`). */
export interface LevelChange {
  readonly changeSeq: bigint;
  readonly level: LevelDocument;
}

export interface LevelChangesQuery {
  readonly gameId: LevelGameId;
  readonly topologies: readonly LevelTopology[];
  /** Only the changes after this position are returned. */
  readonly afterSeq: bigint;
  readonly limit: number;
}

/** Port of the stored levels (ARQ-03-API §3). The Prisma adapter lives in `infrastructure/`. */
export interface ILevelRepository {
  /** The levels created or updated after `afterSeq`, oldest change first, at most `limit` (D-48, RN-COM-77). */
  listChangedAfter(query: LevelChangesQuery): Promise<LevelChange[]>;

  /** The stored version of a level, or `undefined` when no level has that id. */
  findVersion(id: string): Promise<number | undefined>;

  /**
   * Stores a new level.
   * @throws ConflictError `level-exists` when the id is already used (also when two requests arrive at once).
   */
  create(level: ValidatedLevel): Promise<void>;

  /**
   * Replaces a stored level with one of a higher version, which also gives it a new place in the download order.
   * @throws NotFoundError when no level has that id.
   * @throws ConflictError `stale-version` when the stored version is not lower (also under concurrency).
   */
  update(level: ValidatedLevel): Promise<void>;
}
