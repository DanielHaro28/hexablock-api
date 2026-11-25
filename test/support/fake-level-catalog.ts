import type {
  CatalogEntry,
  ILevelCatalog,
} from '../../src/modules/levels/application/level-catalog.js';

/** Hand-written fake of `ILevelCatalog` (D-56): the published levels, by id, in memory. */
export class InMemoryLevelCatalog implements ILevelCatalog {
  readonly asked: string[][] = [];

  constructor(private readonly entries: Readonly<Record<string, CatalogEntry>>) {}

  findByIds(ids: readonly string[]): Promise<ReadonlyMap<string, CatalogEntry>> {
    this.asked.push([...ids]);
    const found = new Map<string, CatalogEntry>();
    for (const id of ids) {
      const entry = this.entries[id];
      if (entry !== undefined) found.set(id, entry);
    }
    return Promise.resolve(found);
  }
}
