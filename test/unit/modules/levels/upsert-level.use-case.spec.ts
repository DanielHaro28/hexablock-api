import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import {
  ConflictError,
  InvalidLevelError,
  NotFoundError,
  ValidationError,
} from '../../../../src/common/domain/domain-error.js';
import { LevelValidator } from '../../../../src/modules/levels/application/level-validator.js';
import { UpsertLevelUseCase } from '../../../../src/modules/levels/application/upsert-level.use-case.js';
import { AjvLevelSchemaChecker } from '../../../../src/modules/levels/infrastructure/ajv-level-schema-checker.js';
import { InMemoryLevelRepository } from '../../../support/fake-level-repository.js';

const EXAMPLES = resolve(import.meta.dirname, '../../../../docs/contracts/examples');

type Json = Record<string, unknown>;

/** The level of the shared example E-HF-NIVEL, a fresh copy for each test. */
function fitLevel(version = 1): Json {
  const level = JSON.parse(
    readFileSync(resolve(EXAMPLES, 'E-HF-NIVEL.fit-hex-001.level.json'), 'utf8'),
  ) as Json;
  return { ...level, version };
}

describe('LVL-02 · UpsertLevelUseCase', () => {
  let validator: LevelValidator;
  let levels: InMemoryLevelRepository;
  let upsert: UpsertLevelUseCase;

  beforeAll(async () => {
    validator = new LevelValidator(await AjvLevelSchemaChecker.create());
  });

  beforeEach(() => {
    levels = new InMemoryLevelRepository();
    upsert = new UpsertLevelUseCase(validator, levels);
  });

  describe('publishing a new level (POST)', () => {
    it('should_store_the_level_and_return_it_when_the_level_is_valid', async () => {
      // Arrange
      const level = fitLevel();

      // Act
      const saved = await upsert.execute({ level });

      // Assert
      expect(saved).toEqual(level);
      expect(levels.published.get('fit-hex-001')?.version).toBe(1);
    });

    it('should_answer_level_exists_when_a_level_with_that_id_is_already_published', async () => {
      // Arrange
      await upsert.execute({ level: fitLevel() });

      // Act
      const second = upsert.execute({ level: fitLevel(2) });

      // Assert
      await expect(second).rejects.toBeInstanceOf(ConflictError);
      await expect(second).rejects.toMatchObject({ code: 'level-exists' });
    });

    it('should_reject_and_store_nothing_when_the_level_is_not_valid', async () => {
      // Arrange
      const level = fitLevel();
      ((level['variant'] as Json)['pieces'] as { shape: unknown[] }[])[1]!.shape.push([1, 1]);

      // Act
      const attempt = upsert.execute({ level });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(InvalidLevelError);
      expect(levels.published.size).toBe(0);
    });

    it('should_reject_for_the_level_and_not_for_the_conflict_when_it_is_both_invalid_and_repeated', async () => {
      // Arrange
      await upsert.execute({ level: fitLevel() });
      const invalid = { ...fitLevel(2), order: 0 };

      // Act
      const attempt = upsert.execute({ level: invalid });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(InvalidLevelError);
    });
  });

  describe('updating a published level (PUT)', () => {
    beforeEach(async () => {
      await upsert.execute({ level: fitLevel(1) });
    });

    it('should_store_the_new_version_and_return_the_level_when_the_version_is_higher', async () => {
      // Act
      const saved = await upsert.execute({ level: fitLevel(2), pathId: 'fit-hex-001' });

      // Assert
      expect(saved['version']).toBe(2);
      expect(levels.published.get('fit-hex-001')?.version).toBe(2);
    });

    it('should_answer_stale_version_when_the_version_is_the_same_as_the_stored_one', async () => {
      // Act
      const attempt = upsert.execute({ level: fitLevel(1), pathId: 'fit-hex-001' });

      // Assert
      await expect(attempt).rejects.toMatchObject({ code: 'stale-version' });
      expect(levels.published.get('fit-hex-001')?.version).toBe(1);
    });

    it('should_answer_stale_version_when_the_version_is_lower_than_the_stored_one', async () => {
      // Arrange
      await upsert.execute({ level: fitLevel(5), pathId: 'fit-hex-001' });

      // Act
      const attempt = upsert.execute({ level: fitLevel(3), pathId: 'fit-hex-001' });

      // Assert
      await expect(attempt).rejects.toMatchObject({ code: 'stale-version' });
    });

    it('should_answer_not_found_when_no_level_has_the_id_of_the_route', async () => {
      // Arrange
      const other = { ...fitLevel(2), id: 'fit-hex-002' };

      // Act
      const attempt = upsert.execute({ level: other, pathId: 'fit-hex-002' });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should_reject_with_a_validation_error_in_id_when_the_id_of_the_body_is_not_the_one_of_the_route', async () => {
      // Act
      const attempt = upsert.execute({ level: fitLevel(2), pathId: 'fit-hex-002' });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(ValidationError);
      await expect(attempt).rejects.toMatchObject({
        errors: [{ pointer: '/id', code: 'id-mismatch' }],
      });
      expect(levels.published.get('fit-hex-001')?.version).toBe(1);
    });

    it('should_reject_for_the_level_when_the_new_version_is_not_valid', async () => {
      // Arrange
      const invalid = { ...fitLevel(2), order: 0 };

      // Act
      const attempt = upsert.execute({ level: invalid, pathId: 'fit-hex-001' });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(InvalidLevelError);
      expect(levels.published.get('fit-hex-001')?.version).toBe(1);
    });
  });
});
