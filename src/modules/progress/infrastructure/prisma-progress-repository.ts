import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { IProgressRepository } from '../application/progress-repository.js';
import type { GameId, GameProgress, Section } from '../domain/progress.js';

/**
 * Adapter of `IProgressRepository`. There is one row per user and variant, and its `sections` column is the JSON
 * of the contract (one section per topology, D-27). The sections come out as they were stored: they were
 * validated and consolidated when they went in.
 */
@Injectable()
export class PrismaProgressRepository implements IProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllOf(userId: string): Promise<GameProgress[]> {
    const rows = await this.prisma.progress.findMany({
      where: { userId },
      orderBy: { gameId: 'asc' },
      select: { gameId: true, sections: true },
    });
    return rows.map((row) => ({
      gameId: row.gameId as GameId,
      sections: row.sections as unknown as Record<string, Section>,
    }));
  }
}
