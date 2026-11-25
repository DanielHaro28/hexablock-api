import { describe, expect, it } from '@jest/globals';
import {
  CELL_LENGTH,
  type Cell,
  cellKey,
  defaultSortBoard,
} from '../../../../src/modules/levels/domain/topology-geometry.js';

function keys(cells: readonly Cell[]): Set<string> {
  return new Set(cells.map(cellKey));
}

describe('RN-TOP-11 · default board of Hexa Sort, by topology', () => {
  it.each([
    ['hex', 19],
    ['square', 20],
    ['tri', 24],
    ['cube', 27],
  ] as const)('should_have_the_cells_of_the_table_when_the_topology_is_%s', (topology, count) => {
    // Act
    const board = defaultSortBoard(topology);

    // Assert
    expect(board).toHaveLength(count);
    expect(keys(board).size).toBe(count);
    expect(board.every((cell) => cell.length === CELL_LENGTH[topology])).toBe(true);
  });

  it('should_be_a_hexagon_of_radius_2_when_the_topology_is_hex (RN-HEX-05)', () => {
    // Act
    const board = keys(defaultSortBoard('hex'));

    // Assert
    expect(board.has('0,0')).toBe(true);
    expect(board.has('2,-2')).toBe(true);
    expect(board.has('-2,2')).toBe(true);
    expect(board.has('2,0')).toBe(true);
    expect(board.has('2,1')).toBe(false); // s = -3
    expect(board.has('3,0')).toBe(false);
  });

  it('should_have_rows_of_5_7_7_and_5_cells_when_the_topology_is_tri (RN-TRI-09, E-TRI-1)', () => {
    // Act
    const board = defaultSortBoard('tri');

    // Assert
    const rows = new Map<number, number>();
    for (const [, y = 0] of board) rows.set(y, (rows.get(y) ?? 0) + 1);
    expect([...rows.entries()].sort(([a], [b]) => a - b)).toEqual([
      [-2, 5],
      [-1, 7],
      [0, 7],
      [1, 5],
    ]);
  });

  it('should_start_at_the_origin_and_be_4_wide_and_5_tall_when_the_topology_is_square', () => {
    // Act
    const board = keys(defaultSortBoard('square'));

    // Assert
    expect(board.has('0,0')).toBe(true);
    expect(board.has('3,4')).toBe(true);
    expect(board.has('4,0')).toBe(false);
    expect(board.has('0,5')).toBe(false);
    expect(board.has('-1,0')).toBe(false);
  });

  it('should_be_a_3_by_3_by_3_box_from_the_origin_when_the_topology_is_cube', () => {
    // Act
    const board = keys(defaultSortBoard('cube'));

    // Assert
    expect(board.has('0,0,0')).toBe(true);
    expect(board.has('2,2,2')).toBe(true);
    expect(board.has('3,0,0')).toBe(false);
  });
});
