import { describe, expect, it } from '@jest/globals';
import {
  type Cell,
  cellKey,
  isConnected,
  neighborsOf,
} from '../../../../src/modules/levels/domain/topology-geometry.js';

function keys(cells: readonly Cell[]): string[] {
  return cells.map(cellKey).sort();
}

describe('RN-COM-11 · neighbours of a cell, by topology', () => {
  it('should_give_the_six_axial_neighbours_when_the_topology_is_hex (RN-HEX-03)', () => {
    // Act
    const neighbors = neighborsOf('hex', [0, 0]);

    // Assert
    expect(keys(neighbors)).toEqual(['-1,0', '-1,1', '0,-1', '0,1', '1,-1', '1,0']);
  });

  it('should_give_the_four_side_neighbours_and_no_diagonals_when_the_topology_is_square (RN-SQR-03)', () => {
    // Act
    const neighbors = neighborsOf('square', [2, 3]);

    // Assert
    expect(keys(neighbors)).toEqual(['1,3', '2,2', '2,4', '3,3']);
  });

  it('should_give_left_right_and_below_when_the_triangle_points_up (RN-TRI-03)', () => {
    // Arrange: (0, 0) has x + y even, so it points up

    // Act
    const neighbors = neighborsOf('tri', [0, 0]);

    // Assert
    expect(keys(neighbors)).toEqual(['-1,0', '0,1', '1,0']);
  });

  it('should_give_left_right_and_above_when_the_triangle_points_down (RN-TRI-03)', () => {
    // Arrange: (1, 0) has x + y odd, so it points down

    // Act
    const neighbors = neighborsOf('tri', [1, 0]);

    // Assert
    expect(keys(neighbors)).toEqual(['0,0', '1,-1', '2,0']);
  });

  it('should_give_the_six_faces_when_the_topology_is_cube (RN-CUB-03)', () => {
    // Act
    const neighbors = neighborsOf('cube', [1, 1, 1]);

    // Assert
    expect(keys(neighbors)).toEqual(['0,1,1', '1,0,1', '1,1,0', '1,1,2', '1,2,1', '2,1,1']);
  });

  it.each([
    ['hex', [3, -2]],
    ['square', [3, -2]],
    ['tri', [3, -2]],
    ['cube', [3, -2, 1]],
  ] as const)(
    'should_be_symmetric_when_a_cell_is_a_neighbour_of_another (%s)',
    (topology, cell) => {
      // Act + Assert: if B is a neighbour of A then A is a neighbour of B
      for (const neighbor of neighborsOf(topology, cell)) {
        expect(keys(neighborsOf(topology, neighbor))).toContain(cellKey(cell));
      }
    },
  );
});

describe('RN-HF-12 b · a group of cells is connected', () => {
  it('should_be_connected_when_it_is_one_cell', () => {
    // Act + Assert
    expect(isConnected('hex', [[5, 5]])).toBe(true);
  });

  it('should_be_connected_when_the_cells_form_an_arc (E-HEX-1)', () => {
    // Act + Assert
    expect(
      isConnected('hex', [
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
    ).toBe(true);
  });

  it('should_not_be_connected_when_two_cells_do_not_touch', () => {
    // Act + Assert
    expect(
      isConnected('hex', [
        [0, 0],
        [2, 0],
      ]),
    ).toBe(false);
  });

  it('should_not_use_cells_outside_the_group_when_looking_for_a_path', () => {
    // Arrange: (0,0) and (2,0) would be linked through (1,0), which is not in the group

    // Act + Assert
    expect(
      isConnected('hex', [
        [0, 0],
        [2, 0],
        [3, 0],
      ]),
    ).toBe(false);
  });

  it('should_not_connect_diagonal_cells_when_the_topology_is_square', () => {
    // Act + Assert
    expect(
      isConnected('square', [
        [0, 0],
        [1, 1],
      ]),
    ).toBe(false);
    expect(
      isConnected('square', [
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
    ).toBe(true);
  });

  it('should_connect_alternating_triangles_when_they_share_a_side', () => {
    // Act + Assert: up (0,0), down (1,0), up (2,0) in one row
    expect(
      isConnected('tri', [
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
    ).toBe(true);
    expect(
      isConnected('tri', [
        [0, 0],
        [2, 0],
      ]),
    ).toBe(false);
  });

  it('should_connect_cells_of_different_layers_when_the_topology_is_cube', () => {
    // Act + Assert
    expect(
      isConnected('cube', [
        [0, 0, 0],
        [0, 0, 1],
      ]),
    ).toBe(true);
    expect(
      isConnected('cube', [
        [0, 0, 0],
        [1, 1, 0],
      ]),
    ).toBe(false);
  });

  it('should_not_be_connected_when_there_are_no_cells', () => {
    // Act + Assert
    expect(isConnected('hex', [])).toBe(false);
  });
});
