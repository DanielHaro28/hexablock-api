import type { FieldError } from '../../../common/domain/domain-error.js';
import type { Topology } from './level-topologies.js';
import { CELL_LENGTH, type Cell, cellKey, isConnected } from './topology-geometry.js';

export interface FitPiece {
  id: string;
  color: string;
  /** Normalized cells in the initial orientation (RN-HF-11). */
  shape: Cell[];
}

/** The `variant` section of a Hexa Fit level (RN-HF-11, `fitVariant` of `level.schema.json`). */
export interface FitVariant {
  figure: Cell[];
  pieces: FitPiece[];
  starThresholds: { moves: number; timeMs: number };
  /** Piece id -> the absolute cells it covers in the figure. */
  solution: Record<string, Cell[]>;
}

const VARIANT = '/variant';

/** RFC 6901: `~` is `~0` and `/` is `~1`. */
function pointer(...segments: (string | number)[]): string {
  return segments
    .map((segment) => String(segment).replaceAll('~', '~0').replaceAll('/', '~1'))
    .reduce((path, segment) => `${path}/${segment}`, '');
}

/** Cells whose numbers do not match the topology, and cells repeated inside one list. */
function checkCellList(
  topology: Topology,
  cells: readonly Cell[],
  at: string,
  errors: FieldError[],
  options: { duplicates: boolean },
): void {
  const seen = new Set<string>();
  cells.forEach((cell, index) => {
    if (cell.length !== CELL_LENGTH[topology]) {
      errors.push({ pointer: `${at}/${index}`, code: 'cell-dimension' });
    } else if (options.duplicates) {
      const key = cellKey(cell);
      if (seen.has(key)) errors.push({ pointer: `${at}/${index}`, code: 'duplicate-cell' });
      seen.add(key);
    }
  });
}

/**
 * The structural rules of a Hexa Fit level, the ones the backend checks (RN-COM-76, D-19): the cells fit the
 * topology and RN-HF-12 a to e and g. Rule f (the solution of each piece is a turned and moved copy of its shape)
 * needs rotations, so the validator of the app checks it before the level is published.
 *
 * The schema was already checked, so the shapes are right (1 to 6 cells, thresholds that are numbers). Every
 * problem is reported, each with the JSON Pointer of what is wrong and the id of the rule as its `code`
 * (`rn-hf-12-d`); when a cell has the wrong number of coordinates only that is reported, because the other rules
 * cannot read it.
 */
export function checkFitStructure(topology: Topology, variant: FitVariant): FieldError[] {
  const errors: FieldError[] = [];

  // Cells that the other rules can read
  checkCellList(topology, variant.figure, `${VARIANT}/figure`, errors, { duplicates: true });
  variant.pieces.forEach((piece, index) => {
    checkCellList(topology, piece.shape, pointer('variant', 'pieces', index, 'shape'), errors, {
      duplicates: true,
    });
  });
  for (const [id, cells] of Object.entries(variant.solution)) {
    checkCellList(topology, cells, pointer('variant', 'solution', id), errors, {
      duplicates: true,
    });
  }
  if (errors.some((error) => error.code === 'cell-dimension')) {
    return errors.filter((error) => error.code === 'cell-dimension');
  }

  const figure = new Set(variant.figure.map(cellKey));

  // (a) the areas of the pieces add up to the area of the figure
  const piecesArea = variant.pieces.reduce((sum, piece) => sum + piece.shape.length, 0);
  if (piecesArea !== figure.size) errors.push({ pointer: `${VARIANT}/pieces`, code: 'rn-hf-12-a' });

  // (b) each piece is one connected shape
  variant.pieces.forEach((piece, index) => {
    if (!isConnected(topology, piece.shape)) {
      errors.push({ pointer: pointer('variant', 'pieces', index, 'shape'), code: 'rn-hf-12-b' });
    }
  });

  // (c) the ids of the pieces are unique
  const ids = new Set<string>();
  variant.pieces.forEach((piece, index) => {
    if (ids.has(piece.id)) {
      errors.push({ pointer: pointer('variant', 'pieces', index, 'id'), code: 'rn-hf-12-c' });
    }
    ids.add(piece.id);
  });

  checkSolution(variant, ids, figure, errors);

  // (g) the thresholds are coherent (RN-HF-63)
  if (variant.starThresholds.moves < variant.pieces.length) {
    errors.push({ pointer: `${VARIANT}/starThresholds/moves`, code: 'rn-hf-12-g' });
  }
  if (variant.starThresholds.timeMs <= 0) {
    errors.push({ pointer: `${VARIANT}/starThresholds/timeMs`, code: 'rn-hf-12-g' });
  }

  return errors;
}

/** (d) and (e): where each piece goes in the reference solution. */
function checkSolution(
  variant: FitVariant,
  pieceIds: ReadonlySet<string>,
  figure: ReadonlySet<string>,
  errors: FieldError[],
): void {
  for (const id of Object.keys(variant.solution)) {
    if (!pieceIds.has(id))
      errors.push({ pointer: pointer('variant', 'solution', id), code: 'rn-hf-12-d' });
  }

  const covered = new Set<string>();
  let missingEntry = false;
  for (const piece of variant.pieces) {
    if (!Object.hasOwn(variant.solution, piece.id)) {
      missingEntry = true;
      continue;
    }
    // A repeated id was already reported by (c); its cells are checked once
    if (piece !== variant.pieces.find((other) => other.id === piece.id)) continue;

    const cells = variant.solution[piece.id] as Cell[];
    if (cells.length !== piece.shape.length) {
      errors.push({ pointer: pointer('variant', 'solution', piece.id), code: 'rn-hf-12-e' });
    }
    cells.forEach((cell, index) => {
      const key = cellKey(cell);
      if (!figure.has(key) || covered.has(key)) {
        errors.push({
          pointer: pointer('variant', 'solution', piece.id, index),
          code: 'rn-hf-12-d',
        });
      }
      covered.add(key);
    });
  }

  if (missingEntry) errors.push({ pointer: `${VARIANT}/solution`, code: 'rn-hf-12-e' });
  if ([...figure].some((key) => !covered.has(key))) {
    errors.push({ pointer: `${VARIANT}/solution`, code: 'rn-hf-12-d' });
  }
}
