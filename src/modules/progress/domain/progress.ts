/** The closed list of variants (`gameId` of the contract, SEC-API-06). */
export type GameId = 'hexa-lines' | 'hexa-fit' | 'hexa-sort' | 'hexa-merge';

/** The variants whose progress is a record, and the ones whose progress is a list of levels (D-45). */
export const HIGH_SCORE_GAMES: readonly GameId[] = ['hexa-lines', 'hexa-merge'];
export const LEVEL_GAMES: readonly GameId[] = ['hexa-fit', 'hexa-sort'];

/** Best result of a variant without levels: the record (`highScoreSection` of the contract). */
export interface HighScoreBest {
  readonly score: number;
  readonly achievedAt: string;
}

/** Best attempt of a Hexa Fit level (`fitAttempt`): stars desc, time asc, moves asc (RN-COM-102). */
export interface FitAttempt {
  readonly stars: number;
  readonly timeMs: number;
  readonly moves: number;
  readonly achievedAt: string;
}

/** Best attempt of a Hexa Sort level (`sortAttempt`): moves asc, score desc (RN-COM-103). */
export interface SortAttempt {
  readonly moves: number;
  readonly score: number;
  readonly achievedAt: string;
}

export type LevelAttempt = FitAttempt | SortAttempt;

export interface HighScoreSection {
  readonly kind: 'highScore';
  readonly best: HighScoreBest;
}

/** A level is completed if it appears here; its value is the best attempt (RN-COM-80). */
export interface LevelsSection {
  readonly kind: 'levels';
  readonly levels: Readonly<Record<string, LevelAttempt>>;
}

export type Section = HighScoreSection | LevelsSection;

/** The progress of one user in one variant: one section per topology (D-27). */
export interface GameProgress {
  readonly gameId: GameId;
  readonly sections: Readonly<Record<string, Section>>;
}
