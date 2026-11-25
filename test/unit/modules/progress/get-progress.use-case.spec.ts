import { describe, expect, it } from '@jest/globals';
import { GetProgressUseCase } from '../../../../src/modules/progress/application/get-progress.use-case.js';
import type { GameProgress } from '../../../../src/modules/progress/domain/progress.js';
import { InMemoryProgressRepository } from '../../../support/fake-progress-repository.js';

const lines: GameProgress = {
  gameId: 'hexa-lines',
  sections: {
    hex: { kind: 'highScore', best: { score: 100, achievedAt: '2026-11-01T10:00:00Z' } },
  },
};
const fit: GameProgress = {
  gameId: 'hexa-fit',
  sections: {
    hex: {
      kind: 'levels',
      levels: {
        'fit-hex-001': { stars: 3, timeMs: 1, moves: 1, achievedAt: '2026-11-01T10:00:00Z' },
      },
    },
  },
};

describe('RN-COM-90 · GetProgressUseCase', () => {
  it('should_return_the_progress_of_every_variant_the_user_has_when_the_user_asks', async () => {
    // Arrange
    const repository = new InMemoryProgressRepository(new Map([['user-1', [lines, fit]]]));

    // Act
    const result = await new GetProgressUseCase(repository).execute({ userId: 'user-1' });

    // Assert
    expect(result.games).toEqual([fit, lines]);
  });

  it('should_return_an_empty_list_when_the_user_has_no_progress', async () => {
    // Act
    const result = await new GetProgressUseCase(new InMemoryProgressRepository()).execute({
      userId: 'user-1',
    });

    // Assert
    expect(result).toEqual({ games: [] });
  });

  describe('SEC-API-01 · the user comes from the token', () => {
    it('should_ask_the_repository_only_for_the_user_it_was_given_when_the_user_asks', async () => {
      // Arrange
      const repository = new InMemoryProgressRepository(
        new Map([
          ['user-1', [lines]],
          ['user-2', [fit]],
        ]),
      );

      // Act
      const result = await new GetProgressUseCase(repository).execute({ userId: 'user-1' });

      // Assert
      expect(repository.queriedFor).toEqual(['user-1']);
      expect(result.games).toEqual([lines]);
    });
  });
});
