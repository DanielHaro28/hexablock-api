import type { FieldError } from '../../../common/domain/domain-error.js';
import { ContractSchemaValidator } from '../../../common/infrastructure/contract-schema-validator.js';
import type { IProgressSchemaChecker } from '../application/progress-schema-checker.js';

const FILES = ['common.schema.json', 'progress.schema.json'] as const;

/**
 * Adapter of `IProgressSchemaChecker`: the parts `progressUpdate` and `gameProgress` of `progress.schema.json`
 * (D-23), which is copied next to the code in the image. Both are read and compiled once.
 */
export class AjvProgressSchemaChecker implements IProgressSchemaChecker {
  private constructor(
    private readonly update: ContractSchemaValidator,
    private readonly gameProgress: ContractSchemaValidator,
  ) {}

  static async create(): Promise<AjvProgressSchemaChecker> {
    return new AjvProgressSchemaChecker(
      await ContractSchemaValidator.create(FILES, 'progress.schema.json#/$defs/progressUpdate'),
      await ContractSchemaValidator.create(FILES, 'progress.schema.json#/$defs/gameProgress'),
    );
  }

  checkUpdate(body: unknown): FieldError[] {
    return this.update.check(body);
  }

  checkGameProgress(progress: unknown): FieldError[] {
    return this.gameProgress.check(progress);
  }
}
