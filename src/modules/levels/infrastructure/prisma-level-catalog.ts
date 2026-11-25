import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { CatalogEntry, ILevelCatalog } from '../application/level-catalog.js';
import type { LevelGameId, LevelTopology } from '../domain/level-topologies.js';

/** Adapter of `ILevelCatalog`: one query for all the ids, whatever their number. */
@Injectable()
export class PrismaLevelCatalog implements ILevelCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async findByIds(ids: readonly string[]): Promise<ReadonlyMap<string, CatalogEntry>> {
    const rows = await this.prisma.level.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, gameId: true, topology: true },
    });
    return new Map(
      rows.map((row) => [
        row.id,
        { gameId: row.gameId as LevelGameId, topology: row.topology as LevelTopology },
      ]),
    );
  }
}
