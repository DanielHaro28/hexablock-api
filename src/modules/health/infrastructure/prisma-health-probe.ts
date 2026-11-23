import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { IHealthProbe } from '../application/health-probe.js';

/** Adapter of `IHealthProbe`: a `SELECT 1`. Any failure means "not available"; the cause stays out of the answer. */
@Injectable()
export class PrismaHealthProbe implements IHealthProbe {
  constructor(private readonly prisma: PrismaService) {}

  async isDatabaseAvailable(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
