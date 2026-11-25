import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { type FieldError, InvalidLevelError } from '../../../../src/common/domain/domain-error.js';
import { LevelValidator } from '../../../../src/modules/levels/application/level-validator.js';
import { AjvLevelSchemaChecker } from '../../../../src/modules/levels/infrastructure/ajv-level-schema-checker.js';

const EXAMPLES = resolve(import.meta.dirname, '../../../../docs/contracts/examples');

type Json = Record<string, unknown>;

function example(file: string): Json {
  return JSON.parse(readFileSync(resolve(EXAMPLES, file), 'utf8')) as Json;
}

/** The errors of a level that must be rejected. */
function rejectionOf(validator: LevelValidator, level: unknown): readonly FieldError[] {
  try {
    validator.validate(level);
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidLevelError);
    return (error as InvalidLevelError).errors;
  }
  throw new Error('The level should have been rejected');
}

describe('RN-COM-71 · LevelValidator (schema and structure)', () => {
  let validator: LevelValidator;

  beforeAll(async () => {
    validator = new LevelValidator(await AjvLevelSchemaChecker.create());
  });

  describe('a valid level', () => {
    it('should_return_the_level_with_its_indexed_columns_when_it_is_the_hexa_fit_example', () => {
      // Arrange
      const level = example('E-HF-NIVEL.fit-hex-001.level.json');

      // Act
      const validated = validator.validate(level);

      // Assert
      expect(validated).toMatchObject({
        id: 'fit-hex-001',
        gameId: 'hexa-fit',
        topology: 'hex',
        order: 1,
        version: 1,
      });
      expect(validated.document).toEqual(level);
    });

    it.each(['sort-any-001.level.json', 'sort-hex-007.level.json'])(
      'should_accept_the_hexa_sort_example_%s',
      (file) => {
        // Act + Assert
        expect(() => validator.validate(example(file))).not.toThrow();
      },
    );
  });

  describe('the schema comes first', () => {
    it('should_reject_with_the_errors_of_the_schema_when_a_field_is_missing', () => {
      // Arrange
      const level = example('sort-any-001.level.json');
      delete level['variant'];

      // Act
      const errors = rejectionOf(validator, level);

      // Assert
      expect(errors).toContainEqual({ pointer: '/variant', code: 'required' });
    });

    it('should_not_run_the_structural_rules_when_the_schema_fails', () => {
      // Arrange: a schema error and, in the same level, a structural one (B with 4 cells)
      const level = example('E-HF-NIVEL.fit-hex-001.level.json');
      level['order'] = 0;
      ((level['variant'] as Json)['pieces'] as { shape: unknown[] }[])[1]!.shape.push([1, 1]);

      // Act
      const errors = rejectionOf(validator, level);

      // Assert
      expect(errors).toContainEqual({ pointer: '/order', code: 'too-small' });
      expect(errors.some((error) => error.code.startsWith('rn-hf-12'))).toBe(false);
    });

    it('should_reject_when_the_body_is_not_an_object', () => {
      // Act
      const errors = rejectionOf(validator, 'a level');

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('the structural rules of the variant', () => {
    it('should_reject_with_the_rule_when_a_hexa_fit_piece_breaks_rn_hf_12', () => {
      // Arrange
      const level = example('E-HF-NIVEL.fit-hex-001.level.json');
      ((level['variant'] as Json)['pieces'] as { shape: unknown[] }[])[1]!.shape.push([1, 1]);

      // Act
      const errors = rejectionOf(validator, level);

      // Assert
      expect(errors).toContainEqual({ pointer: '/variant/pieces', code: 'rn-hf-12-a' });
    });

    it('should_reject_with_the_rule_when_a_hexa_sort_stack_breaks_rn_hs_12', () => {
      // Arrange
      const level = example('sort-hex-007.level.json');
      ((level['variant'] as Json)['initialStacks'] as { cell: number[] }[])[0]!.cell = [3, 0];

      // Act
      const errors = rejectionOf(validator, level);

      // Assert
      expect(errors).toContainEqual({
        pointer: '/variant/initialStacks/0/cell',
        code: 'rn-hs-12-board',
      });
    });
  });

  describe('RN-COM-70 · the id says the variant and the topology (D-47)', () => {
    it('should_reject_when_the_topology_of_the_id_is_not_the_topology_of_the_level', () => {
      // Arrange: `fit-hex-001` with topology square
      const level = { ...example('E-HF-NIVEL.fit-hex-001.level.json'), topology: 'square' };

      // Act
      const errors = rejectionOf(validator, level);

      // Assert
      expect(errors).toContainEqual({ pointer: '/id', code: 'rn-com-70-id' });
    });

    it('should_accept_the_id_of_a_sort_level_with_topology_any', () => {
      // Act + Assert
      expect(() => validator.validate(example('sort-any-001.level.json'))).not.toThrow();
    });
  });
});
