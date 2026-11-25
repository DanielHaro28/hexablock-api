import type { FitAttempt, GameId, HighScoreBest, Section, SortAttempt } from './progress.js';

/** The highest score that each variant accepts (RN-COM-108). Hexa Fit has no score: it is stars, time and moves. */
export type ScoreCaps = Readonly<Record<Exclude<GameId, 'hexa-fit'>, number>>;

/**
 * Starting values of the caps. The documents say "a cap per variant (configurable)" without giving numbers, so
 * these are generous on purpose (the server is not an anti-cheat, SEC-API-06): they only stop absurd values that
 * would put a cheater at the top of a ranking. The team should replace them with what the variants can reach.
 */
export const DEFAULT_SCORE_CAPS: ScoreCaps = {
  'hexa-lines': 1_000_000,
  'hexa-merge': 10_000_000,
  'hexa-sort': 1_000_000,
};

/** Clocks of phones are never exact: a result up to this much in the future is accepted (ARQ-04-API §3). */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Plausibility of the results that arrive in a sync (RN-COM-108, SEC-API-06, ARQ-S-02): the server does not play
 * the game, it only discards what cannot happen. Stars from 1 to 3, a score from 0 to the cap of the variant, and a
 * date that is not in the future (with a tolerance of 5 minutes). That a level exists is checked against the
 * catalog by the use case. It is not a full anti-cheat, and that is accepted.
 */
export class PlausibilityPolicy {
  constructor(private readonly caps: ScoreCaps) {}

  /** True when every result of every section is plausible; one that is not rejects the whole update. */
  isPlausible(gameId: GameId, sections: Readonly<Record<string, Section>>, now: Date): boolean {
    const latest = now.getTime() + FUTURE_TOLERANCE_MS;
    return Object.values(sections).every((section) =>
      section.kind === 'highScore'
        ? this.resultIsPlausible(gameId, section.best, latest)
        : Object.values(section.levels).every((attempt) =>
            this.resultIsPlausible(gameId, attempt, latest),
          ),
    );
  }

  private resultIsPlausible(
    gameId: GameId,
    result: HighScoreBest | FitAttempt | SortAttempt,
    latest: number,
  ): boolean {
    const instant = Date.parse(result.achievedAt);
    if (Number.isNaN(instant) || instant > latest) return false;

    if ('stars' in result)
      return Number.isInteger(result.stars) && result.stars >= 1 && result.stars <= 3;
    return this.scoreIsPlausible(gameId, result.score);
  }

  private scoreIsPlausible(gameId: GameId, score: number): boolean {
    if (gameId === 'hexa-fit') return false; // a Hexa Fit result has stars, never a bare score
    return Number.isInteger(score) && score >= 0 && score <= this.caps[gameId];
  }
}
