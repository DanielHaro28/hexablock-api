import type { FieldError } from '../../src/common/domain/domain-error.js';
import type { IProgressSchemaChecker } from '../../src/modules/progress/application/progress-schema-checker.js';

/** Hand-written fake of `IProgressSchemaChecker` (D-56): it answers the errors a test gives it. */
export class FakeProgressSchemaChecker implements IProgressSchemaChecker {
  readonly updates: unknown[] = [];
  readonly gameProgresses: unknown[] = [];

  constructor(
    private readonly updateErrors: readonly FieldError[] = [],
    private readonly gameProgressErrors: readonly FieldError[] = [],
  ) {}

  checkUpdate(body: unknown): FieldError[] {
    this.updates.push(body);
    return [...this.updateErrors];
  }

  checkGameProgress(progress: unknown): FieldError[] {
    this.gameProgresses.push(progress);
    return [...this.gameProgressErrors];
  }
}
