import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { AjvLevelSchemaChecker } from '../../../../src/modules/levels/infrastructure/ajv-level-schema-checker.js';

const EXAMPLES = resolve(import.meta.dirname, '../../../../docs/contracts/examples');

type Json = Record<string, unknown>;

/** An example level of the contract, a fresh copy for each test. */
function example(file: string): Json {
  return JSON.parse(readFileSync(resolve(EXAMPLES, file), 'utf8')) as Json;
}

describe('RN-COM-71 · AjvLevelSchemaChecker (level.schema.json)', () => {
  let checker: AjvLevelSchemaChecker;

  beforeAll(async () => {
    checker = await AjvLevelSchemaChecker.create();
  });

  it.each([
    'E-HF-NIVEL.fit-hex-001.level.json',
    'sort-any-001.level.json',
    'sort-hex-007.level.json',
  ])('should_accept_the_level_when_it_is_the_example_%s', (file) => {
    // Act
    const errors = checker.check(example(file));

    // Assert
    expect(errors).toEqual([]);
  });

  it('should_report_the_missing_property_with_its_pointer_when_a_required_field_is_absent', () => {
    // Arrange
    const level = example('sort-any-001.level.json');
    delete level['name'];

    // Act
    const errors = checker.check(level);

    // Assert
    expect(errors).toContainEqual({ pointer: '/name', code: 'required' });
  });

  it('should_report_the_property_when_the_level_has_a_field_that_is_not_allowed', () => {
    // Arrange
    const level = { ...example('sort-any-001.level.json'), solution: 'secret' };

    // Act
    const errors = checker.check(level);

    // Assert
    expect(errors).toContainEqual({ pointer: '/solution', code: 'not-allowed' });
  });

  it('should_report_the_property_inside_the_variant_when_the_variant_has_an_unknown_field', () => {
    // Arrange
    const level = example('sort-any-001.level.json');
    (level['variant'] as Json)['extra'] = 1;

    // Act
    const errors = checker.check(level);

    // Assert
    expect(errors).toContainEqual({ pointer: '/variant/extra', code: 'not-allowed' });
  });

  it.each([
    ['an id with the wrong format', { id: 'Fit_Hex_1' }, '/id', 'invalid-format'],
    ['an unknown variant', { gameId: 'hexa-lines' }, '/gameId', 'invalid-value'],
    ['an order of 0', { order: 0 }, '/order', 'too-small'],
    ['a version that is not an integer', { version: 1.5 }, '/version', 'invalid-type'],
    ['an id that is not a string', { id: 7 }, '/id', 'invalid-type'],
  ])(
    'should_report_the_field_and_the_rule_when_the_level_has_%s',
    (_label, change, pointer, code) => {
      // Arrange
      const level = { ...example('sort-any-001.level.json'), ...change };

      // Act
      const errors = checker.check(level);

      // Assert
      expect(errors).toContainEqual({ pointer, code });
    },
  );

  it('should_report_the_prefix_when_a_hexa_fit_id_does_not_start_with_fit', () => {
    // Arrange
    const level = { ...example('E-HF-NIVEL.fit-hex-001.level.json'), id: 'sort-hex-001' };

    // Act
    const errors = checker.check(level);

    // Assert
    expect(errors).toContainEqual({ pointer: '/id', code: 'invalid-format' });
  });

  it('should_report_the_topology_when_a_hexa_fit_level_has_topology_any', () => {
    // Arrange
    const level = { ...example('E-HF-NIVEL.fit-hex-001.level.json'), topology: 'any' };

    // Act
    const errors = checker.check(level);

    // Assert
    expect(errors.some((error) => error.pointer === '/topology')).toBe(true);
  });

  it('should_report_the_stacks_when_a_level_with_topology_any_has_initial_stacks', () => {
    // Arrange
    const level = example('sort-any-001.level.json');
    (level['variant'] as Json)['initialStacks'] = [{ cell: [0, 0], stack: ['red'] }];

    // Act
    const errors = checker.check(level);

    // Assert
    expect(errors.some((error) => error.pointer.startsWith('/variant/initialStacks'))).toBe(true);
  });

  it('should_report_the_item_when_a_palette_repeats_a_colour', () => {
    // Arrange
    const level = example('sort-any-001.level.json');
    (level['variant'] as Json)['palette'] = ['red', 'red', 'blue'];

    // Act
    const errors = checker.check(level);

    // Assert
    expect(errors).toContainEqual({ pointer: '/variant/palette', code: 'duplicate-item' });
  });

  it.each([
    ['null', null],
    ['a string', 'level'],
    ['an array', []],
    ['a number', 7],
  ])('should_report_the_whole_body_when_the_body_is_%s', (_label, body) => {
    // Act
    const errors = checker.check(body);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((error) => error.pointer === '' || error.pointer.startsWith('/'))).toBe(
      true,
    );
  });

  it('should_never_repeat_the_submitted_values_when_the_level_is_not_valid', () => {
    // Arrange
    const level = {
      ...example('sort-any-001.level.json'),
      id: 'SECRET-VALUE',
      extra: 'SECRET-EXTRA',
    };

    // Act
    const errors = checker.check(level);

    // Assert
    expect(JSON.stringify(errors)).not.toContain('SECRET');
  });

  it('should_return_the_same_error_once_when_a_rule_fails_in_several_branches', () => {
    // Arrange
    const level = { ...example('E-HF-NIVEL.fit-hex-001.level.json'), id: 'x' };

    // Act
    const errors = checker.check(level);

    // Assert
    const keys = errors.map((error) => `${error.pointer}|${error.code}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
