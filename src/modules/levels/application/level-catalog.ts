import type { LevelGameId, LevelTopology } from '../domain/level-topologies.js';

/** What the catalog knows about a published level: where it belongs. */
export interface CatalogEntry {
  readonly gameId: LevelGameId;
  readonly topology: LevelTopology;
}

/**
 * Port of the published levels as other modules see them (ARQ-03-API §3): `progress` asks whether the level of a
 * result exists (RN-COM-108). The adapter lives in the infrastructure of `levels`, which owns the table.
 */
export interface ILevelCatalog {
  /** The published levels among `ids`, by id. An id that is not published is not in the map. */
  findByIds(ids: readonly string[]): Promise<ReadonlyMap<string, CatalogEntry>>;
}
