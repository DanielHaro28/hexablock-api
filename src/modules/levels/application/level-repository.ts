import type { LevelGameId, LevelTopology } from '../domain/level-topologies.js';

/** A published level exactly as it was validated and stored: the JSON of `level.schema.json`. */
export type LevelDocument = Readonly<Record<string, unknown>>;

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
}
