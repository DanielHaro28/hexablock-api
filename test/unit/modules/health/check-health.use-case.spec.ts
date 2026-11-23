import { describe, expect, it } from '@jest/globals';
import { ServiceUnavailableError } from '../../../../src/common/domain/domain-error.js';
import { CheckHealthUseCase } from '../../../../src/modules/health/application/check-health.use-case.js';
import type { IHealthProbe } from '../../../../src/modules/health/application/health-probe.js';

/** Fake of the port (D-56): it answers what the test says. */
class FakeHealthProbe implements IHealthProbe {
  constructor(private readonly available: boolean) {}

  isDatabaseAvailable(): Promise<boolean> {
    return Promise.resolve(this.available);
  }
}

describe('RF-92 · CheckHealthUseCase', () => {
  it('should_report_ok_when_the_database_is_available', async () => {
    // Arrange
    const useCase = new CheckHealthUseCase(new FakeHealthProbe(true));

    // Act
    const result = await useCase.execute();

    // Assert
    expect(result).toEqual({ status: 'ok' });
  });

  it('should_throw_service_unavailable_when_the_database_is_not_available', async () => {
    // Arrange
    const useCase = new CheckHealthUseCase(new FakeHealthProbe(false));

    // Act
    const result = useCase.execute();

    // Assert
    await expect(result).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});
