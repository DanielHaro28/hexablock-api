import { Controller, Get, Inject } from '@nestjs/common';
import type { UseCase } from '../../../common/application/use-case.js';
import { Public } from '../../../common/presentation/public.js';
import type { HealthStatus } from '../application/check-health.use-case.js';
import { CHECK_HEALTH } from '../health.tokens.js';

/** The only route without the `/v1` prefix: the Docker healthcheck and the monitoring use it (D-46). */
@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(CHECK_HEALTH) private readonly checkHealth: UseCase<void, HealthStatus>) {}

  @Get()
  check(): Promise<HealthStatus> {
    return this.checkHealth.execute();
  }
}
