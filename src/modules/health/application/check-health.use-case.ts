import type { UseCase } from '../../../common/application/use-case.js';
import { ServiceUnavailableError } from '../../../common/domain/domain-error.js';
import type { IHealthProbe } from './health-probe.js';

export interface HealthStatus {
  readonly status: 'ok';
}

/** `GET /health` (RF-92): the API is up and so is the database. Without the database it is a 503. */
export class CheckHealthUseCase implements UseCase<void, HealthStatus> {
  constructor(private readonly probe: IHealthProbe) {}

  async execute(): Promise<HealthStatus> {
    if (!(await this.probe.isDatabaseAvailable())) throw new ServiceUnavailableError();
    return { status: 'ok' };
  }
}
