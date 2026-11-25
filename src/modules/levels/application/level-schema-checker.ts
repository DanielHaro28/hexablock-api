import type { FieldError } from '../../../common/domain/domain-error.js';

/**
 * Port of the schema check of a level (RN-COM-71): it answers, for any JSON, which fields break
 * `level.schema.json`. The adapter uses the same schema file as the app, so both repos accept the same levels
 * (D-23, D-47).
 */
export interface ILevelSchemaChecker {
  /** The problems of `level`, each with a JSON Pointer and a `code`; empty when the level is valid. */
  check(level: unknown): FieldError[];
}
