import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import type { FieldError } from '../../../../src/common/domain/domain-error.js';
import {
  type SortVariant,
  checkSortStructure,
} from '../../../../src/modules/levels/domain/sort-level-rules.js';
import { defaultSortBoard } from '../../../../src/modules/levels/domain/topology-geometry.js';

const EXAMPLES = resolve(import.meta.dirname, '../../../../docs/contracts/examples');

/** The `variant` of an example level of the contract, a fresh copy for each test. */
function variantOf(file: string): SortVariant {
  const level = JSON.parse(readFileSync(resolve(EXAMPLES, file), 'utf8')) as {
    variant: SortVariant;
  };
  return structuredClone(level.variant);
}

function codes(errors: readonly FieldError[]): string[] {
  return errors.map((error) => error.code);
}

const WITH_STACKS = (): SortVariant => variantOf('sort-hex-007.level.json');

describe('RN-HS-12 · structural rules of a Hexa Sort level', () => {
  describe('the examples of the contract', () => {
    it('should_pass_when_the_level_has_no_stacks_and_any_topology (sort-any-001)', () => {
      // Act
      const errors = checkSortStructure('any', variantOf('sort-any-001.level.json'));

      // Assert
      expect(errors).toEqual([]);
    });

    it('should_pass_when_the_level_has_initial_stacks_on_a_hexagon_board (sort-hex-007)', () => {
      // Act
      const errors = checkSortStructure('hex', WITH_STACKS());

      // Assert
      expect(errors).toEqual([]);
    });
  });

  describe('generation parameters', () => {
    it('should_fail_when_the_minimum_height_is_above_the_maximum', () => {
      // Arrange
      const variant = WITH_STACKS();
      variant.generation = { minHeight: 5, maxHeight: 3, maxBlocks: 2 };

      // Act
      const errors = checkSortStructure('hex', variant);

      // Assert
      expect(errors).toContainEqual({
        pointer: '/variant/generation',
        code: 'rn-hs-12-generation',
      });
    });

    it('should_pass_when_the_minimum_height_equals_the_maximum', () => {
      // Arrange
      const variant = WITH_STACKS();
      variant.generation = { minHeight: 4, maxHeight: 4, maxBlocks: 2 };

      // Act
      const errors = checkSortStructure('hex', variant);

      // Assert
      expect(errors).toEqual([]);
    });
  });

  describe('initial stacks and the board', () => {
    it('should_fail_when_a_stack_is_outside_the_default_board', () => {
      // Arrange: (3, 0) is outside the hexagon of radius 2
      const variant = WITH_STACKS();
      variant.initialStacks![1]!.cell = [3, 0];

      // Act
      const errors = checkSortStructure('hex', variant);

      // Assert
      expect(errors).toContainEqual({
        pointer: '/variant/initialStacks/1/cell',
        code: 'rn-hs-12-board',
      });
    });

    it('should_accept_a_stack_in_a_cell_of_the_custom_board_when_the_level_declares_a_board', () => {
      // Arrange: a board with a cell that the default one does not have
      const variant = WITH_STACKS();
      variant.board = [...defaultSortBoard('hex'), [3, 0]];
      variant.initialStacks![1]!.cell = [3, 0];

      // Act
      const errors = checkSortStructure('hex', variant);

      // Assert
      expect(errors).toEqual([]);
    });

    it('should_fail_when_a_stack_is_outside_the_custom_board', () => {
      // Arrange: the board is two cells and the stack is on a third
      const variant = WITH_STACKS();
      variant.board = [
        [0, 0],
        [1, 0],
      ];

      // Act
      const errors = checkSortStructure('hex', variant);

      // Assert
      expect(errors).toContainEqual({
        pointer: '/variant/initialStacks/0/cell',
        code: 'rn-hs-12-board',
      });
    });

    it('should_fail_when_two_stacks_are_in_the_same_cell', () => {
      // Arrange
      const variant = WITH_STACKS();
      variant.initialStacks![1]!.cell = [2, -2];

      // Act
      const errors = checkSortStructure('hex', variant);

      // Assert
      expect(errors).toContainEqual({
        pointer: '/variant/initialStacks/1/cell',
        code: 'duplicate-cell',
      });
    });

    it('should_fail_when_the_custom_board_repeats_a_cell', () => {
      // Arrange
      const variant = WITH_STACKS();
      variant.board = [...defaultSortBoard('hex'), [0, 0]];

      // Act
      const errors = checkSortStructure('hex', variant);

      // Assert
      expect(errors).toContainEqual({ pointer: '/variant/board/19', code: 'duplicate-cell' });
    });

    it('should_report_only_the_dimension_when_a_cell_has_the_wrong_length_for_the_topology', () => {
      // Arrange: a cube cell in a hexagon level
      const variant = WITH_STACKS();
      variant.initialStacks![0]!.cell = [2, -2, 0];

      // Act
      const errors = checkSortStructure('hex', variant);

      // Assert
      expect(errors).toEqual([
        { pointer: '/variant/initialStacks/0/cell', code: 'cell-dimension' },
      ]);
    });

    it('should_use_the_default_board_of_the_topology_when_the_level_is_square', () => {
      // Arrange: the default square board is 4 wide and 5 tall
      const variant = WITH_STACKS();
      variant.initialStacks = [
        { cell: [3, 4], stack: ['red'] },
        { cell: [4, 0], stack: ['red'] },
      ];

      // Act
      const errors = checkSortStructure('square', variant);

      // Assert
      expect(errors).toEqual([
        { pointer: '/variant/initialStacks/1/cell', code: 'rn-hs-12-board' },
      ]);
    });
  });

  describe('colours and the top block', () => {
    it('should_fail_when_a_tile_has_a_colour_that_is_not_in_the_palette', () => {
      // Arrange
      const variant = WITH_STACKS();
      variant.initialStacks![0]!.stack = ['green', 'orange'];

      // Act
      const errors = checkSortStructure('hex', variant);

      // Assert
      expect(errors).toContainEqual({
        pointer: '/variant/initialStacks/0/stack/1',
        code: 'rn-hs-12-color',
      });
    });

    it('should_fail_when_the_top_block_has_10_tiles_of_the_same_colour', () => {
      // Arrange
      const variant = WITH_STACKS();
      variant.initialStacks![0]!.stack = ['blue', ...Array<string>(10).fill('red')];

      // Act
      const errors = checkSortStructure('hex', variant);

      // Assert
      expect(errors).toContainEqual({
        pointer: '/variant/initialStacks/0/stack',
        code: 'rn-hs-12-top',
      });
    });

    it('should_pass_when_the_top_block_has_9_tiles', () => {
      // Arrange
      const variant = WITH_STACKS();
      variant.initialStacks![0]!.stack = ['blue', ...Array<string>(9).fill('red')];

      // Act
      const errors = checkSortStructure('hex', variant);

      // Assert
      expect(errors).toEqual([]);
    });

    it('should_pass_when_a_block_of_10_tiles_is_not_on_top', () => {
      // Arrange: only the block on top counts (RN-HS-12)
      const variant = WITH_STACKS();
      variant.initialStacks![0]!.stack = [...Array<string>(10).fill('red'), 'blue'];

      // Act
      const errors = checkSortStructure('hex', variant);

      // Assert
      expect(errors).toEqual([]);
    });
  });

  describe('at least one empty cell', () => {
    function fillBoard(cells: number): SortVariant {
      const variant = WITH_STACKS();
      variant.initialStacks = defaultSortBoard('hex')
        .slice(0, cells)
        .map((cell) => ({ cell, stack: ['red'] }));
      return variant;
    }

    it('should_pass_when_one_cell_of_the_board_is_left_empty', () => {
      // Act
      const errors = checkSortStructure('hex', fillBoard(18));

      // Assert
      expect(errors).toEqual([]);
    });

    it('should_fail_when_the_stacks_fill_every_cell_of_the_board', () => {
      // Act
      const errors = checkSortStructure('hex', fillBoard(19));

      // Assert
      expect(codes(errors)).toEqual(['rn-hs-12-empty']);
      expect(errors[0]?.pointer).toBe('/variant/initialStacks');
    });
  });

  it('should_report_every_broken_rule_when_several_are_broken', () => {
    // Arrange
    const variant = WITH_STACKS();
    variant.generation = { minHeight: 6, maxHeight: 2, maxBlocks: 1 };
    variant.initialStacks![0]!.stack = ['pink'];

    // Act
    const errors = checkSortStructure('hex', variant);

    // Assert
    expect(codes(errors)).toEqual(
      expect.arrayContaining(['rn-hs-12-generation', 'rn-hs-12-color']),
    );
  });
});
