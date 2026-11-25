import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  ILevelRepository,
  LevelChange,
  LevelChangesQuery,
  LevelDocument,
} from '../application/level-repository.js';

/**
 * Adapter of `ILevelRepository`. `change_seq` comes from a sequence of the database: the column default gives
 * it on `INSERT` and a trigger renews it on `UPDATE`, so an updated level comes back after any cursor that was
 * issued before the update (D-48, ARQ-04-API §5).
 */
@Injectable()
export class PrismaLevelRepository implements ILevelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listChangedAfter(query: LevelChangesQuery): Promise<LevelChange[]> {
    const rows = await this.prisma.level.findMany({
      where: {
        gameId: query.gameId,
        topology: { in: [...query.topologies] },
        changeSeq: { gt: query.afterSeq },
      },
      orderBy: { changeSeq: 'asc' },
      take: query.limit,
      select: { changeSeq: true, data: true },
    });
    return rows.map((row) => ({ changeSeq: row.changeSeq, level: row.data as LevelDocument }));
  }
}
