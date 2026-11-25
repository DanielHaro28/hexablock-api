import type { Topology } from './level-topologies.js';

/** The address of a cell (D-47): `[q, r]` in hexagons, `[x, y]` in squares and triangles, `[x, y, z]` in cubes. */
export type Cell = readonly number[];

/** How many numbers a cell has in each topology (the schema says the validator checks it). */
export const CELL_LENGTH: Readonly<Record<Topology, number>> = {
  hex: 2,
  square: 2,
  tri: 2,
  cube: 3,
};

/** A string that is the same for the same cell, to keep cells in sets and maps. */
export function cellKey(cell: Cell): string {
  return cell.join(',');
}

/** The addresses of the cells that share a side (2D) or a face (3D) with `cell`, wherever the board is. */
export function neighborsOf(topology: Topology, cell: Cell): Cell[] {
  const [a = 0, b = 0, c = 0] = cell;
  switch (topology) {
    case 'hex': // RN-HEX-02, RN-HEX-03: the six axial directions
      return [
        [a + 1, b],
        [a - 1, b],
        [a + 1, b - 1],
        [a - 1, b + 1],
        [a, b - 1],
        [a, b + 1],
      ];
    case 'square': // RN-SQR-02, RN-SQR-03: no diagonals
      return [
        [a, b - 1],
        [a + 1, b],
        [a, b + 1],
        [a - 1, b],
      ];
    case 'tri': {
      // RN-TRI-03: left and right in the same row, and below for an up-pointing cell (x + y even) or above for a
      // down-pointing one
      const pointsUp = (a + b) % 2 === 0;
      return [
        [a - 1, b],
        [a + 1, b],
        [a, pointsUp ? b + 1 : b - 1],
      ];
    }
    case 'cube': // RN-CUB-02, RN-CUB-03: the six faces
      return [
        [a + 1, b, c],
        [a - 1, b, c],
        [a, b + 1, c],
        [a, b - 1, c],
        [a, b, c + 1],
        [a, b, c - 1],
      ];
  }
}

/**
 * True when the cells form one group in which every cell touches another by a side or a face (RN-HF-12 b). The
 * group is looked at by itself: a path through cells that are not in `cells` does not count.
 */
export function isConnected(topology: Topology, cells: readonly Cell[]): boolean {
  const first = cells[0];
  if (first === undefined) return false;

  const pending = new Set(cells.map(cellKey));
  const toVisit: Cell[] = [first];
  pending.delete(cellKey(first));
  while (toVisit.length > 0) {
    const current = toVisit.pop() as Cell;
    for (const neighbor of neighborsOf(topology, current)) {
      if (pending.delete(cellKey(neighbor))) toVisit.push(neighbor);
    }
  }
  return pending.size === 0;
}
