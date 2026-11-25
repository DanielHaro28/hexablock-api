import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import type { FieldError } from '../../../../src/common/domain/domain-error.js';
import {
  type FitVariant,
  checkFitStructure,
} from '../../../../src/modules/levels/domain/fit-level-rules.js';

const EXAMPLE = resolve(
  import.meta.dirname,
  '../../../../docs/contracts/examples/E-HF-NIVEL.fit-hex-001.level.json',
);

/** The `variant` of the shared example E-HF-NIVEL (02-RN-NIVELES §4), a fresh copy for each test. */
function eHfNivel(): FitVariant {
  const level = JSON.parse(readFileSync(EXAMPLE, 'utf8')) as { variant: FitVariant };
  return structuredClone(level.variant);
}

function codes(errors: readonly FieldError[]): string[] {
  return errors.map((error) => error.code);
}

describe('E-HF-NIVEL · the shared example of RN-HF-12', () => {
  it('should_pass_every_structural_rule_when_the_level_is_the_example', () => {
    // Act
    const errors = checkFitStructure('hex', eHfNivel());

    // Assert
    expect(errors).toEqual([]);
  });

  it('should_fail_a_when_piece_b_has_four_cells', () => {
    // Arrange: the first variation of 02-RN-NIVELES §4
    const variant = eHfNivel();
    variant.pieces[1]!.shape = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(codes(errors)).toContain('rn-hf-12-a');
    expect(errors.find((error) => error.code === 'rn-hf-12-a')?.pointer).toBe('/variant/pieces');
  });

  it('should_fail_d_when_the_solution_of_a_has_a_cell_outside_the_figure', () => {
    // Arrange: the second variation: (3, 0) is not in the figure
    const variant = eHfNivel();
    variant.solution['A'] = [
      [2, -1],
      [2, 0],
      [3, 0],
    ];

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toContainEqual({ pointer: '/variant/solution/A/2', code: 'rn-hf-12-d' });
  });

  it('should_pass_the_structural_rules_when_the_solution_of_a_is_a_line_that_the_app_rejects_later', () => {
    // Arrange: the third variation. A covers the line (0,0) (1,0) (2,0) and B the rest of the figure. Every
    // structural rule holds; only the geometric one (f, a turned copy of the shape) fails, and it belongs to the
    // validator of the app (D-19)
    const variant = eHfNivel();
    variant.solution['A'] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    variant.solution['B'] = [
      [0, 1],
      [1, 1],
      [2, -1],
    ];

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toEqual([]);
  });
});

describe('RN-HF-12 · structural rules of a Hexa Fit level', () => {
  it('should_fail_b_when_a_piece_is_not_connected', () => {
    // Arrange: A with two cells that do not touch (the sum of the areas stays 3 + 3 with the solution of A)
    const variant = eHfNivel();
    variant.pieces[0]!.shape = [
      [0, 0],
      [2, 0],
      [3, 0],
    ];

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toContainEqual({ pointer: '/variant/pieces/0/shape', code: 'rn-hf-12-b' });
  });

  it('should_fail_c_when_two_pieces_have_the_same_id', () => {
    // Arrange
    const variant = eHfNivel();
    variant.pieces[1]!.id = 'A';

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toContainEqual({ pointer: '/variant/pieces/1/id', code: 'rn-hf-12-c' });
  });

  it('should_fail_d_when_two_pieces_cover_the_same_cell_of_the_solution', () => {
    // Arrange: B takes (2,0) too, which A already covers
    const variant = eHfNivel();
    variant.solution['B'] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toContainEqual({ pointer: '/variant/solution/B/2', code: 'rn-hf-12-d' });
  });

  it('should_fail_d_when_the_solution_does_not_cover_the_whole_figure', () => {
    // Arrange: the figure has a seventh cell that no piece covers; the areas of the pieces still add up to 6,
    // so (a) fails too, but the cover is its own rule
    const variant = eHfNivel();
    variant.figure.push([0, 2]);

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toContainEqual({ pointer: '/variant/solution', code: 'rn-hf-12-d' });
  });

  it('should_fail_d_when_the_solution_names_a_piece_that_does_not_exist', () => {
    // Arrange
    const variant = eHfNivel();
    variant.solution['Z'] = [[0, 0]];

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toContainEqual({ pointer: '/variant/solution/Z', code: 'rn-hf-12-d' });
  });

  it('should_fail_e_when_a_piece_has_a_different_number_of_cells_in_the_solution', () => {
    // Arrange: A covers two cells in the solution but has three in its shape
    const variant = eHfNivel();
    variant.solution['A'] = [
      [2, -1],
      [2, 0],
    ];

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toContainEqual({ pointer: '/variant/solution/A', code: 'rn-hf-12-e' });
  });

  it('should_fail_e_when_a_piece_has_no_entry_in_the_solution', () => {
    // Arrange
    const variant = eHfNivel();
    delete variant.solution['B'];

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toContainEqual({ pointer: '/variant/solution', code: 'rn-hf-12-e' });
  });

  it('should_fail_g_when_the_moves_are_fewer_than_the_pieces', () => {
    // Arrange: two pieces cannot be placed in fewer than two moves (RN-HF-63)
    const variant = eHfNivel();
    variant.starThresholds.moves = 1;

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toContainEqual({
      pointer: '/variant/starThresholds/moves',
      code: 'rn-hf-12-g',
    });
  });

  it('should_pass_g_when_the_moves_are_equal_to_the_pieces', () => {
    // Arrange
    const variant = eHfNivel();
    variant.starThresholds.moves = 2;

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toEqual([]);
  });

  it('should_fail_g_when_the_time_is_not_positive', () => {
    // Arrange
    const variant = eHfNivel();
    variant.starThresholds.timeMs = 0;

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toContainEqual({
      pointer: '/variant/starThresholds/timeMs',
      code: 'rn-hf-12-g',
    });
  });

  it('should_report_every_broken_rule_when_several_are_broken', () => {
    // Arrange
    const variant = eHfNivel();
    variant.pieces[1]!.id = 'A';
    variant.starThresholds.moves = 1;

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(codes(errors)).toEqual(expect.arrayContaining(['rn-hf-12-c', 'rn-hf-12-g']));
  });
});

describe('RN-COM-76 · cells of a Hexa Fit level', () => {
  it('should_report_a_cell_dimension_when_a_cell_has_the_wrong_length_for_the_topology', () => {
    // Arrange: a cube cell in a hexagon level
    const variant = eHfNivel();
    variant.figure[0] = [2, -1, 0];

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert: only the dimension is reported, the other rules need well formed cells
    expect(errors).toEqual([{ pointer: '/variant/figure/0', code: 'cell-dimension' }]);
  });

  it('should_report_a_cell_dimension_in_a_piece_and_in_the_solution_when_they_have_the_wrong_length', () => {
    // Arrange
    const variant = eHfNivel();
    variant.pieces[0]!.shape[1] = [1];
    variant.solution['B']![0] = [0, 0, 0];

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toEqual([
      { pointer: '/variant/pieces/0/shape/1', code: 'cell-dimension' },
      { pointer: '/variant/solution/B/0', code: 'cell-dimension' },
    ]);
  });

  it('should_report_a_duplicate_cell_when_the_figure_repeats_a_cell', () => {
    // Arrange
    const variant = eHfNivel();
    variant.figure.push([0, 0]);

    // Act
    const errors = checkFitStructure('hex', variant);

    // Assert
    expect(errors).toContainEqual({ pointer: '/variant/figure/6', code: 'duplicate-cell' });
  });

  it('should_use_the_geometry_of_the_topology_when_the_level_is_square', () => {
    // Arrange: two dominoes on a 2 x 2 square figure
    const variant: FitVariant = {
      figure: [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ],
      pieces: [
        {
          id: 'A',
          color: 'teal',
          shape: [
            [0, 0],
            [1, 0],
          ],
        },
        {
          id: 'B',
          color: 'orange',
          shape: [
            [0, 0],
            [1, 0],
          ],
        },
      ],
      starThresholds: { moves: 2, timeMs: 10_000 },
      solution: {
        A: [
          [0, 0],
          [1, 0],
        ],
        B: [
          [0, 1],
          [1, 1],
        ],
      },
    };

    // Act
    const valid = checkFitStructure('square', variant);
    variant.pieces[0]!.shape = [
      [0, 0],
      [1, 1],
    ];
    const diagonal = checkFitStructure('square', variant);

    // Assert: a diagonal is not a connected piece in squares
    expect(valid).toEqual([]);
    expect(diagonal).toContainEqual({ pointer: '/variant/pieces/0/shape', code: 'rn-hf-12-b' });
  });
});
