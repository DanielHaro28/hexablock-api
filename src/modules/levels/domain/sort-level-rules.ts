import type { FieldError } from '../../../common/domain/domain-error.js';
import type { LevelTopology } from './level-topologies.js';
import { CELL_LENGTH, type Cell, cellKey, defaultSortBoard } from './topology-geometry.js';

export interface SortStack {
  cell: Cell;
  /** Tiles from bottom to top (RN-HS-01). */
  stack: string[];
}

/** The `variant` section of a Hexa Sort level (RN-HS-11, `sortVariant` of `level.schema.json`). */
export interface SortVariant {
  goals: number;
  palette: string[];
  seed: number;
  generation: { minHeight: number; maxHeight: number; maxBlocks: number };
  /** A custom board; without it the default board of the topology is used. */
  board?: Cell[];
  initialStacks?: SortStack[];
}

/** A block of this many tiles or more on top of a stack is already complete (RN-HS-12). */
const MAX_TOP_BLOCK = 9;

const VARIANT = '/variant';

/** The tiles of the block on top: the last colour, as many times as it repeats at the end. */
function topBlockSize(stack: readonly string[]): number {
  const top = stack.at(-1);
  let size = 0;
  for (let index = stack.length - 1; index >= 0 && stack[index] === top; index--) size++;
  return size;
}

/**
 * The structural rules of a Hexa Sort level (RN-HS-12; goals and the palette are in the schema): the generation
 * parameters are coherent, and the initial stacks are inside the board, have colours of the palette, none has a
 * top block of 10 tiles or more, and at least one cell stays empty. Each problem has the JSON Pointer of what is
 * wrong and a `code`: `rn-hs-12-<part>`, or `cell-dimension` and `duplicate-cell` for the cells themselves.
 *
 * A level with topology `any` has no board and no stacks (the schema says so), so only the generation counts.
 * When a cell has the wrong number of coordinates only that is reported, because the other rules cannot read it.
 */
export function checkSortStructure(topology: LevelTopology, variant: SortVariant): FieldError[] {
  const errors: FieldError[] = [];

  if (variant.generation.minHeight > variant.generation.maxHeight) {
    errors.push({ pointer: `${VARIANT}/generation`, code: 'rn-hs-12-generation' });
  }
  if (topology === 'any') return errors;

  const stacks = variant.initialStacks ?? [];
  const cellLength = CELL_LENGTH[topology];

  const dimensionErrors: FieldError[] = [];
  const customBoard = variant.board;
  customBoard?.forEach((cell, index) => {
    if (cell.length !== cellLength) {
      dimensionErrors.push({ pointer: `${VARIANT}/board/${index}`, code: 'cell-dimension' });
    }
  });
  stacks.forEach((stack, index) => {
    if (stack.cell.length !== cellLength) {
      dimensionErrors.push({
        pointer: `${VARIANT}/initialStacks/${index}/cell`,
        code: 'cell-dimension',
      });
    }
  });
  if (dimensionErrors.length > 0) return dimensionErrors;

  const board = new Set<string>();
  const boardCells = customBoard ?? defaultSortBoard(topology);
  boardCells.forEach((cell, index) => {
    const key = cellKey(cell);
    if (board.has(key))
      errors.push({ pointer: `${VARIANT}/board/${index}`, code: 'duplicate-cell' });
    board.add(key);
  });

  const palette = new Set(variant.palette);
  const occupied = new Set<string>();
  stacks.forEach((stack, index) => {
    const at = `${VARIANT}/initialStacks/${index}`;
    const key = cellKey(stack.cell);
    if (!board.has(key)) errors.push({ pointer: `${at}/cell`, code: 'rn-hs-12-board' });
    if (occupied.has(key)) errors.push({ pointer: `${at}/cell`, code: 'duplicate-cell' });
    occupied.add(key);

    stack.stack.forEach((color, tile) => {
      if (!palette.has(color))
        errors.push({ pointer: `${at}/stack/${tile}`, code: 'rn-hs-12-color' });
    });
    if (topBlockSize(stack.stack) > MAX_TOP_BLOCK) {
      errors.push({ pointer: `${at}/stack`, code: 'rn-hs-12-top' });
    }
  });

  if (stacks.length > 0 && [...board].every((key) => occupied.has(key))) {
    errors.push({ pointer: `${VARIANT}/initialStacks`, code: 'rn-hs-12-empty' });
  }

  return errors;
}
