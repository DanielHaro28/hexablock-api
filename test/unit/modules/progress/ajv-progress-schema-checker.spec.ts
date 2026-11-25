import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { AjvProgressSchemaChecker } from '../../../../src/modules/progress/infrastructure/ajv-progress-schema-checker.js';

const EXAMPLES = resolve(import.meta.dirname, '../../../../docs/contracts/examples');

type Json = Record<string, unknown>;

function example(file: string): Json {
  return JSON.parse(readFileSync(resolve(EXAMPLES, file), 'utf8')) as Json;
}

const FIT_ATTEMPT = { stars: 3, timeMs: 1000, moves: 3, achievedAt: '2026-11-10T14:00:00Z' };
const SORT_ATTEMPT = { moves: 5, score: 100, achievedAt: '2026-11-10T14:00:00Z' };

describe('RN-COM-86 · AjvProgressSchemaChecker (progress.schema.json)', () => {
  let checker: AjvProgressSchemaChecker;

  beforeAll(async () => {
    checker = await AjvProgressSchemaChecker.create();
  });

  describe('the body of the update (progressUpdate)', () => {
    it('should_accept_the_body_when_it_is_the_example_with_only_the_changed_level', () => {
      // Act
      const errors = checker.checkUpdate(example('sync.progress-update.json'));

      // Assert
      expect(errors).toEqual([]);
    });

    it.each([
      ['no sections', {}, '/sections', 'required'],
      ['an empty sections object', { sections: {} }, '/sections', 'too-short'],
      [
        'a field that is not allowed',
        {
          sections: {
            hex: { kind: 'highScore', best: { score: 1, achievedAt: '2026-11-10T14:00:00Z' } },
          },
          userId: 'x',
        },
        '/userId',
        'not-allowed',
      ],
      [
        'an unknown topology',
        {
          sections: {
            triangle: { kind: 'highScore', best: { score: 1, achievedAt: '2026-11-10T14:00:00Z' } },
          },
        },
        '/sections',
        'invalid-key',
      ],
    ])(
      'should_report_the_field_and_the_rule_when_the_body_has_%s',
      (_label, body, pointer, code) => {
        // Act
        const errors = checker.checkUpdate(body);

        // Assert
        expect(errors).toContainEqual({ pointer, code });
      },
    );

    it.each([null, 'sections', 7, []])('should_report_the_whole_body_when_it_is_%j', (body) => {
      // Act
      const errors = checker.checkUpdate(body);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should_report_a_stars_value_out_of_range_when_a_fit_attempt_has_4_stars', () => {
      // Arrange
      const body = {
        sections: {
          hex: { kind: 'levels', levels: { 'fit-hex-001': { ...FIT_ATTEMPT, stars: 4 } } },
        },
      };

      // Act
      const errors = checker.checkUpdate(body);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should_never_repeat_the_values_that_were_sent_when_the_body_is_not_valid', () => {
      // Arrange
      const body = { sections: {}, secret: 'SECRET-VALUE' };

      // Act
      const errors = checker.checkUpdate(body);

      // Assert
      expect(JSON.stringify(errors)).not.toContain('SECRET');
    });
  });

  describe('the progress that results for the variant of the route (gameProgress)', () => {
    it('should_accept_the_examples_when_the_shape_is_the_one_of_the_variant', () => {
      // Act + Assert
      expect(checker.checkGameProgress(example('E-COM-2.device.progress.json'))).toEqual([]);
      expect(checker.checkGameProgress(example('lines.progress.json'))).toEqual([]);
    });

    it('should_reject_fit_levels_when_the_variant_is_hexa_lines', () => {
      // Arrange: the sections of the Fit example under the gameId of Lines
      const progress = { ...example('E-COM-2.device.progress.json'), gameId: 'hexa-lines' };

      // Act
      const errors = checker.checkGameProgress(progress);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should_reject_a_record_when_the_variant_is_hexa_fit', () => {
      // Arrange
      const progress = { ...example('lines.progress.json'), gameId: 'hexa-fit' };

      // Act
      const errors = checker.checkGameProgress(progress);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should_reject_sort_attempts_when_the_variant_is_hexa_fit', () => {
      // Arrange
      const progress = {
        gameId: 'hexa-fit',
        sections: { hex: { kind: 'levels', levels: { 'sort-hex-001': SORT_ATTEMPT } } },
      };

      // Act
      const errors = checker.checkGameProgress(progress);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should_reject_a_level_of_another_variant_when_the_attempt_has_the_right_shape', () => {
      // Arrange: the id says `sort-` in a Hexa Fit progress
      const progress = {
        gameId: 'hexa-fit',
        sections: { hex: { kind: 'levels', levels: { 'sort-hex-001': FIT_ATTEMPT } } },
      };

      // Act
      const errors = checker.checkGameProgress(progress);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should_accept_sort_attempts_when_the_variant_is_hexa_sort', () => {
      // Arrange
      const progress = {
        gameId: 'hexa-sort',
        sections: { hex: { kind: 'levels', levels: { 'sort-hex-001': SORT_ATTEMPT } } },
      };

      // Act + Assert
      expect(checker.checkGameProgress(progress)).toEqual([]);
    });
  });
});
