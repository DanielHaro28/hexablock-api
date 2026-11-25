import type {
  FitAttempt,
  GameId,
  GameProgress,
  HighScoreBest,
  LevelAttempt,
  Section,
  SortAttempt,
} from './progress.js';

type Result = HighScoreBest | LevelAttempt;

/**
 * The key that orders two results of a variant: the smaller key is the better result. It is the criterion of the
 * ranking too (RN-COM-101 to 103), and the last element is the instant, so a tie goes to the earliest (RN-COM-105).
 */
function sortKey(gameId: GameId, result: Result): number[] {
  const instant = Date.parse(result.achievedAt);
  switch (gameId) {
    case 'hexa-fit': {
      const fit = result as FitAttempt;
      return [-fit.stars, fit.timeMs, fit.moves, instant]; // stars desc, time asc, moves asc
    }
    case 'hexa-sort': {
      const sort = result as SortAttempt;
      return [sort.moves, -sort.score, instant]; // moves asc, score desc
    }
    default:
      return [-(result as HighScoreBest).score, instant]; // record: score desc
  }
}

function compareKeys(a: readonly number[], b: readonly number[]): number {
  for (let index = 0; index < a.length; index++) {
    const difference = (a[index] as number) - (b[index] as number);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * The better of two results, taken as a whole (RN-COM-83). When they are equal in every criterion the one with
 * the smaller date text wins, so the answer does not depend on the order of the arguments (RN-COM-84).
 */
function better<T extends Result>(gameId: GameId, a: T, b: T): T {
  const order = compareKeys(sortKey(gameId, a), sortKey(gameId, b));
  if (order !== 0) return structuredClone(order < 0 ? a : b);
  return structuredClone(a.achievedAt <= b.achievedAt ? a : b);
}

function consolidateSections(gameId: GameId, a: Section, b: Section): Section {
  if (a.kind === 'highScore' && b.kind === 'highScore') {
    return { kind: 'highScore', best: better(gameId, a.best, b.best) };
  }
  if (a.kind === 'levels' && b.kind === 'levels') {
    const levels: Record<string, LevelAttempt> = {};
    for (const id of [...new Set([...Object.keys(a.levels), ...Object.keys(b.levels)])].sort()) {
      const left = a.levels[id];
      const right = b.levels[id];
      levels[id] =
        left === undefined || right === undefined
          ? structuredClone((left ?? right) as LevelAttempt)
          : better(gameId, left, right);
    }
    return { kind: 'levels', levels };
  }
  throw new Error('The sections of one topology have different shapes');
}

/**
 * Consolidation of the progress (RN-COM-83, 84; D-49; the reference is `check_contracts.py`, ARQ-S-03): the
 * levels completed are the union, the record is the maximum, and the best attempt of each level is the better of
 * the two according to the criterion of the variant, taken whole. It only improves, it does not depend on the
 * order of the arguments, and combining the same progress again changes nothing, so it is safe to send only what
 * changed and to retry. It never changes its arguments and does not share objects with them.
 */
export const ProgressConsolidator = {
  consolidate(a: GameProgress, b: GameProgress): GameProgress {
    if (a.gameId !== b.gameId) throw new Error('Progress of different variants cannot be combined');

    const sections: Record<string, Section> = {};
    for (const topology of [
      ...new Set([...Object.keys(a.sections), ...Object.keys(b.sections)]),
    ].sort()) {
      const left = a.sections[topology];
      const right = b.sections[topology];
      sections[topology] =
        left === undefined || right === undefined
          ? structuredClone((left ?? right) as Section)
          : consolidateSections(a.gameId, left, right);
    }
    return { gameId: a.gameId, sections };
  },
} as const;
