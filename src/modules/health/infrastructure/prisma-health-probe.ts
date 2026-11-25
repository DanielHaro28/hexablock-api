import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { IHealthProbe } from '../application/health-probe.js';

/**
 * How long `/health` waits for the database. `pg` has no connection timeout by default, so a host that drops
 * packets instead of refusing the connection would leave the request hanging instead of answering 503.
 */
export const HEALTH_QUERY_TIMEOUT_MS = 2000;

/** Adapter of `IHealthProbe`: a `SELECT 1`. Any failure means "not available"; the cause stays out of the answer. */
@Injectable()
export class PrismaHealthProbe implements IHealthProbe {
  constructor(
    private readonly prisma: PrismaService,
    // `@Optional` keeps Nest from looking for a provider of `Number`; only the tests pass a value.
    @Optional() private readonly timeoutMs: number = HEALTH_QUERY_TIMEOUT_MS,
  ) {}

  async isDatabaseAvailable(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('database health check timed out'));
      }, this.timeoutMs);
    });
    try {
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
