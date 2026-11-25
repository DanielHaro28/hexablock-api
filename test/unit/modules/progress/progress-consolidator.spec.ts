import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import type { GameProgress } from '../../../../src/modules/progress/domain/progress.js';
import { ProgressConsolidator } from '../../../../src/modules/progress/domain/progress-consolidator.js';

const EXAMPLES = resolve(import.meta.dirname, '../../../../docs/contracts/examples');

/** An example of the contract, a fresh copy for each use. */
function example<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(EXAMPLES, file), 'utf8')) as T;
}

const device = () => example<GameProgress>('E-COM-2.device.progress.json');
const server = () => example<GameProgress>('E-COM-2.server.progress.json');
const consolidated = () => example<GameProgress>('E-COM-2.consolidated.progress.json');

const consolidate = (a: GameProgress, b: GameProgress) => ProgressConsolidator.consolidate(a, b);

describe('E-COM-2 · ProgressConsolidator (RN-COM-83, 84; D-49)', () => {
  it('should_give_the_consolidated_progress_when_the_device_and_the_server_are_combined', () => {
    // Act
    const result = consolidate(device(), server());

    // Assert
    expect(result).toEqual(consolidated());
  });

  it('should_give_the_same_result_when_the_order_of_the_two_is_the_other', () => {
    // Act
    const result = consolidate(server(), device());

    // Assert
    expect(result).toEqual(consolidated());
  });

  it('should_give_the_same_result_when_the_consolidated_progress_is_combined_again', () => {
    // Act + Assert: repeating a sync never changes the result
    expect(consolidate(consolidated(), device())).toEqual(consolidated());
    expect(consolidate(consolidated(), server())).toEqual(consolidated());
    expect(consolidate(consolidated(), consolidated())).toEqual(consolidated());
  });

  it('should_not_lose_progress_when_only_the_level_that_changed_is_sent (D-49)', () => {
    // Arrange: the request has only fit-hex-003, the rest of the device is already in the server
    const partial: GameProgress = {
      gameId: 'hexa-fit',
      sections: example<{ sections: GameProgress['sections'] }>('sync.progress-update.json')
        .sections,
    };

    // Act
    const result = consolidate(consolidate(server(), partial), device());

    // Assert
    expect(result).toEqual(consolidated());
  });

  it('should_keep_the_best_attempt_of_each_level_complete_and_not_mix_their_values', () => {
    // Act
    const result = consolidate(device(), server());

    // Assert: fit-hex-001 is the server one as a whole (3 stars, 38 s, 3 moves), not 3 stars with the 30 s
    const levels = (result.sections['hex'] as { levels: Record<string, unknown> }).levels;
    expect(levels['fit-hex-001']).toEqual({
      stars: 3,
      timeMs: 38000,
      moves: 3,
      achievedAt: '2026-11-09T20:00:00Z',
    });
  });

  it('should_not_change_its_arguments_when_it_combines_them', () => {
    // Arrange
    const a = device();
    const b = server();

    // Act
    consolidate(a, b);

    // Assert
    expect(a).toEqual(device());
    expect(b).toEqual(server());
  });

  it('should_not_share_objects_with_its_arguments_when_a_section_is_only_in_one_of_them', () => {
    // Arrange
    const a = device();
    const empty: GameProgress = { gameId: 'hexa-fit', sections: {} };

    // Act
    const result = consolidate(a, empty);
    (result.sections['hex'] as { levels: Record<string, { stars: number }> }).levels[
      'fit-hex-001'
    ]!.stars = 99;

    // Assert
    expect(a).toEqual(device());
  });
});

describe('RN-COM-83 · each section is combined by its own shape', () => {
  const lines = (...scores: [number, string][]): GameProgress => ({
    gameId: 'hexa-lines',
    sections: {
      hex: { kind: 'highScore', best: { score: scores[0]![0], achievedAt: scores[0]![1] } },
    },
  });

  it('should_keep_the_maximum_when_a_record_is_combined', () => {
    // Act
    const result = consolidate(
      lines([1240, '2026-11-12T18:30:00Z']),
      lines([900, '2026-11-13T10:00:00Z']),
    );

    // Assert
    expect(result.sections['hex']).toEqual({
      kind: 'highScore',
      best: { score: 1240, achievedAt: '2026-11-12T18:30:00Z' },
    });
  });

  it('should_keep_the_earliest_when_two_records_are_equal (RN-COM-105)', () => {
    // Arrange
    const early = lines([500, '2026-11-01T10:00:00Z']);
    const late = lines([500, '2026-11-05T10:00:00Z']);

    // Act + Assert: in any order
    expect(consolidate(early, late).sections['hex']).toEqual(early.sections['hex']);
    expect(consolidate(late, early).sections['hex']).toEqual(early.sections['hex']);
  });

  it('should_keep_both_topologies_when_each_progress_has_its_own', () => {
    // Arrange
    const onlyHex = lines([100, '2026-11-01T10:00:00Z']);
    const onlySquare: GameProgress = {
      gameId: 'hexa-lines',
      sections: {
        square: { kind: 'highScore', best: { score: 50, achievedAt: '2026-11-02T10:00:00Z' } },
      },
    };

    // Act
    const result = consolidate(onlyHex, onlySquare);

    // Assert (D-27: one section per topology)
    expect(Object.keys(result.sections).sort()).toEqual(['hex', 'square']);
  });

  it('should_order_hexa_sort_attempts_by_moves_asc_then_score_desc (RN-COM-103)', () => {
    // Arrange
    const sort = (moves: number, score: number, achievedAt: string): GameProgress => ({
      gameId: 'hexa-sort',
      sections: {
        hex: { kind: 'levels', levels: { 'sort-hex-001': { moves, score, achievedAt } } },
      },
    });
    const pick = (a: GameProgress, b: GameProgress) =>
      (
        consolidate(a, b).sections['hex'] as {
          levels: Record<string, { moves: number; score: number }>;
        }
      ).levels['sort-hex-001'];

    // Act + Assert: fewer moves wins even with a lower score; the same moves, the higher score
    expect(
      pick(sort(10, 100, '2026-11-01T10:00:00Z'), sort(8, 50, '2026-11-02T10:00:00Z')),
    ).toMatchObject({
      moves: 8,
      score: 50,
    });
    expect(
      pick(sort(8, 50, '2026-11-01T10:00:00Z'), sort(8, 90, '2026-11-02T10:00:00Z')),
    ).toMatchObject({
      moves: 8,
      score: 90,
    });
  });

  it('should_order_hexa_fit_attempts_by_stars_then_time_then_moves_then_date (RN-COM-102, 105)', () => {
    // Arrange
    const fit = (
      stars: number,
      timeMs: number,
      moves: number,
      achievedAt: string,
    ): GameProgress => ({
      gameId: 'hexa-fit',
      sections: {
        hex: { kind: 'levels', levels: { 'fit-hex-001': { stars, timeMs, moves, achievedAt } } },
      },
    });
    const pick = (a: GameProgress, b: GameProgress) =>
      (consolidate(a, b).sections['hex'] as { levels: Record<string, { achievedAt: string }> })
        .levels['fit-hex-001']!.achievedAt;
    const t1 = '2026-11-01T10:00:00Z';
    const t2 = '2026-11-02T10:00:00Z';

    // Act + Assert
    expect(pick(fit(2, 10, 1, t1), fit(3, 99, 9, t2))).toBe(t2); // more stars
    expect(pick(fit(3, 50, 1, t1), fit(3, 40, 9, t2))).toBe(t2); // less time
    expect(pick(fit(3, 40, 5, t1), fit(3, 40, 3, t2))).toBe(t2); // fewer moves
    expect(pick(fit(3, 40, 3, t2), fit(3, 40, 3, t1))).toBe(t1); // the earliest
    expect(pick(fit(3, 40, 3, t1), fit(3, 40, 3, t2))).toBe(t1);
  });

  it('should_compare_the_instant_and_not_the_text_when_the_dates_have_fractions', () => {
    // Arrange: 10:00:00.500Z is later than 10:00:00Z, though the text of the first sorts before the second
    const a: GameProgress = {
      gameId: 'hexa-lines',
      sections: {
        hex: { kind: 'highScore', best: { score: 5, achievedAt: '2026-11-01T10:00:00.500Z' } },
      },
    };
    const b: GameProgress = {
      gameId: 'hexa-lines',
      sections: {
        hex: { kind: 'highScore', best: { score: 5, achievedAt: '2026-11-01T10:00:00Z' } },
      },
    };

    // Act
    const result = consolidate(a, b);

    // Assert
    expect(result.sections['hex']).toEqual(b.sections['hex']);
  });

  it('should_give_the_same_result_in_any_order_when_two_attempts_are_the_same_instant_written_differently', () => {
    // Arrange: equal in every criterion; only the text of the date differs
    const withFraction: GameProgress = {
      gameId: 'hexa-lines',
      sections: {
        hex: { kind: 'highScore', best: { score: 5, achievedAt: '2026-11-01T10:00:00.000Z' } },
      },
    };
    const without: GameProgress = {
      gameId: 'hexa-lines',
      sections: {
        hex: { kind: 'highScore', best: { score: 5, achievedAt: '2026-11-01T10:00:00Z' } },
      },
    };

    // Act + Assert (RN-COM-84: the order of the arguments never changes the result)
    expect(consolidate(withFraction, without)).toEqual(consolidate(without, withFraction));
  });

  it('should_refuse_to_combine_when_the_progress_is_of_different_variants', () => {
    // Act + Assert
    expect(() => consolidate(device(), { gameId: 'hexa-sort', sections: {} })).toThrow();
  });
});
