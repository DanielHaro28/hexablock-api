import { Module } from '@nestjs/common';
import { CheckHealthUseCase } from './application/check-health.use-case.js';
import type { IHealthProbe } from './application/health-probe.js';
import { CHECK_HEALTH, HEALTH_PROBE } from './health.tokens.js';
import { PrismaHealthProbe } from './infrastructure/prisma-health-probe.js';
import { HealthController } from './presentation/health.controller.js';

/** Composition root of `health` (layer 4): the port is wired to its Prisma adapter, and the use case to the port. */
@Module({
  controllers: [HealthController],
  providers: [
    PrismaHealthProbe,
    { provide: HEALTH_PROBE, useExisting: PrismaHealthProbe },
    {
      provide: CHECK_HEALTH,
      inject: [HEALTH_PROBE],
      useFactory: (probe: IHealthProbe) => new CheckHealthUseCase(probe),
    },
  ],
})
export class HealthModule {}
