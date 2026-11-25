import { describe, expect, it } from '@jest/globals';
import type { GameId, Section } from '../../../../src/modules/progress/domain/progress.js';
import {
  DEFAULT_SCORE_CAPS,
  PlausibilityPolicy,
} from '../../../../src/modules/progress/domain/plausibility-policy.js';

const NOW = new Date('2026-11-25T12:00:00Z');
const policy = new PlausibilityPolicy(DEFAULT_SCORE_CAPS);

function fit(stars: number, achievedAt = '2026-11-25T11:00:00Z'): Record<string, Section> {
  return {
    hex: {
      kind: 'levels',
      levels: { 'fit-hex-001': { stars, timeMs: 1000, moves: 3, achievedAt } },
    },
  };
}

function sort(score: number, achievedAt = '2026-11-25T11:00:00Z'): Record<string, Section> {
  return {
    hex: { kind: 'levels', levels: { 'sort-hex-001': { moves: 5, score, achievedAt } } },
  };
}

function record(score: number, achievedAt = '2026-11-25T11:00:00Z'): Record<string, Section> {
  return { hex: { kind: 'highScore', best: { score, achievedAt } } };
}

describe('SEC-API-06 · PlausibilityPolicy (RN-COM-108)', () => {
  describe('stars of Hexa Fit', () => {
    it.each([1, 2, 3])('should_accept_the_result_when_the_stars_are_%s', (stars) => {
      // Act + Assert
      expect(policy.isPlausible('hexa-fit', fit(stars), NOW)).toBe(true);
    });

    it.each([0, 4, -1, 1.5])('should_reject_the_result_when_the_stars_are_%s', (stars) => {
      // Act + Assert
      expect(policy.isPlausible('hexa-fit', fit(stars), NOW)).toBe(false);
    });
  });

  describe('score under the cap of the variant', () => {
    it.each<[GameId, Record<string, Section>]>([
      ['hexa-lines', record(DEFAULT_SCORE_CAPS['hexa-lines'])],
      ['hexa-merge', record(DEFAULT_SCORE_CAPS['hexa-merge'])],
      ['hexa-sort', sort(DEFAULT_SCORE_CAPS['hexa-sort'])],
      ['hexa-lines', record(0)],
    ])('should_accept_the_result_when_the_score_is_at_the_cap_or_zero (%s)', (gameId, sections) => {
      // Act + Assert
      expect(policy.isPlausible(gameId, sections, NOW)).toBe(true);
    });

    it.each<[GameId, Record<string, Section>]>([
      ['hexa-lines', record(DEFAULT_SCORE_CAPS['hexa-lines'] + 1)],
      ['hexa-merge', record(DEFAULT_SCORE_CAPS['hexa-merge'] + 1)],
      ['hexa-sort', sort(DEFAULT_SCORE_CAPS['hexa-sort'] + 1)],
      ['hexa-lines', record(-1)],
      ['hexa-sort', sort(-5)],
    ])(
      'should_reject_the_result_when_the_score_is_above_the_cap_or_negative (%s)',
      (gameId, sections) => {
        // Act + Assert
        expect(policy.isPlausible(gameId, sections, NOW)).toBe(false);
      },
    );

    it('should_use_the_cap_it_was_given_when_the_policy_is_configured', () => {
      // Arrange
      const strict = new PlausibilityPolicy({ ...DEFAULT_SCORE_CAPS, 'hexa-lines': 100 });

      // Act + Assert
      expect(strict.isPlausible('hexa-lines', record(100), NOW)).toBe(true);
      expect(strict.isPlausible('hexa-lines', record(101), NOW)).toBe(false);
    });
  });

  describe('date of the result', () => {
    it('should_accept_the_result_when_the_date_is_in_the_past', () => {
      // Act + Assert
      expect(policy.isPlausible('hexa-fit', fit(2, '2026-01-01T00:00:00Z'), NOW)).toBe(true);
    });

    it('should_accept_the_result_when_the_date_is_within_five_minutes_of_the_future', () => {
      // Arrange: clocks are never exact
      const almost = '2026-11-25T12:05:00Z';

      // Act + Assert
      expect(policy.isPlausible('hexa-fit', fit(2, almost), NOW)).toBe(true);
    });

    it('should_reject_the_result_when_the_date_is_more_than_five_minutes_in_the_future', () => {
      // Arrange
      const tooLate = '2026-11-25T12:05:01Z';

      // Act + Assert
      expect(policy.isPlausible('hexa-fit', fit(2, tooLate), NOW)).toBe(false);
      expect(policy.isPlausible('hexa-lines', record(10, tooLate), NOW)).toBe(false);
    });

    it('should_reject_the_result_when_the_date_cannot_be_read', () => {
      // Act + Assert
      expect(policy.isPlausible('hexa-fit', fit(2, 'tomorrow'), NOW)).toBe(false);
    });
  });

  describe('every section and level is checked', () => {
    it('should_reject_the_whole_update_when_one_level_among_many_is_not_plausible', () => {
      // Arrange: fit-hex-001 is fine, fit-hex-002 has 4 stars
      const sections: Record<string, Section> = {
        hex: {
          kind: 'levels',
          levels: {
            'fit-hex-001': { stars: 3, timeMs: 1, moves: 1, achievedAt: '2026-11-25T11:00:00Z' },
            'fit-hex-002': { stars: 4, timeMs: 1, moves: 1, achievedAt: '2026-11-25T11:00:00Z' },
          },
        },
      };

      // Act + Assert
      expect(policy.isPlausible('hexa-fit', sections, NOW)).toBe(false);
    });

    it('should_reject_the_whole_update_when_a_second_topology_is_not_plausible', () => {
      // Arrange
      const sections: Record<string, Section> = {
        ...record(10),
        square: { kind: 'highScore', best: { score: -1, achievedAt: '2026-11-25T11:00:00Z' } },
      };

      // Act + Assert
      expect(policy.isPlausible('hexa-lines', sections, NOW)).toBe(false);
    });
  });
});
