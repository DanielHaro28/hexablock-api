import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../../common/domain/domain-error.js';
import { Prisma } from '../../../prisma/generated/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  ILevelRepository,
  LevelChange,
  LevelChangesQuery,
  LevelDocument,
  ValidatedLevel,
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

  async findVersion(id: string): Promise<number | undefined> {
    const row = await this.prisma.level.findUnique({ where: { id }, select: { version: true } });
    return row?.version;
  }

  async create(level: ValidatedLevel): Promise<void> {
    try {
      await this.prisma.level.create({
        data: { ...columnsOf(level), id: level.id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new ConflictError('level-exists');
      }
      throw error;
    }
  }

  async update(level: ValidatedLevel): Promise<void> {
    // The version goes in the condition, so two administrators that update at once cannot both win
    const { count } = await this.prisma.level.updateMany({
      where: { id: level.id, version: { lt: level.version } },
      data: columnsOf(level),
    });
    if (count === 0) {
      throw (await this.findVersion(level.id)) === undefined
        ? new NotFoundError()
        : new ConflictError('stale-version');
    }
  }
}

/** Prisma error code for a violated unique constraint. */
const UNIQUE_VIOLATION = 'P2002';

/** The columns of a level: the indexed ones, and the whole document in `data`. */
function columnsOf(level: ValidatedLevel) {
  return {
    gameId: level.gameId,
    topology: level.topology,
    order: level.order,
    version: level.version,
    data: level.document as Prisma.InputJsonObject,
  };
}
