import type { FieldError } from '../../../common/domain/domain-error.js';
import { ContractSchemaValidator } from '../../../common/infrastructure/contract-schema-validator.js';
import type { ILevelSchemaChecker } from '../application/level-schema-checker.js';

/**
 * Adapter of `ILevelSchemaChecker`: `level.schema.json`, the single source of the contract (D-23), which is
 * copied next to the code in the image. The schema is read and compiled once.
 */
export class AjvLevelSchemaChecker implements ILevelSchemaChecker {
  private constructor(private readonly validator: ContractSchemaValidator) {}

  static async create(): Promise<AjvLevelSchemaChecker> {
    return new AjvLevelSchemaChecker(
      await ContractSchemaValidator.create(
        ['common.schema.json', 'level.schema.json'],
        'level.schema.json',
      ),
    );
  }

  check(level: unknown): FieldError[] {
    return this.validator.check(level);
  }
}
