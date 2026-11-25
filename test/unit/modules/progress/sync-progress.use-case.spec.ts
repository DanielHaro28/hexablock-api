import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  ImplausibleResultError,
  ValidationError,
} from '../../../../src/common/domain/domain-error.js';
import type { CatalogEntry } from '../../../../src/modules/levels/application/level-catalog.js';
import { SyncProgressUseCase } from '../../../../src/modules/progress/application/sync-progress.use-case.js';
import {
  DEFAULT_SCORE_CAPS,
  PlausibilityPolicy,
} from '../../../../src/modules/progress/domain/plausibility-policy.js';
import type { GameProgress } from '../../../../src/modules/progress/domain/progress.js';
import { FakeClock } from '../../../support/fake-clock.js';
import { InMemoryLevelCatalog } from '../../../support/fake-level-catalog.js';
import { FakeProgressSchemaChecker } from '../../../support/fake-progress-schema-checker.js';
import { InMemoryTransactionRunner } from '../../../support/in-memory-transaction-runner.js';

const EXAMPLES = resolve(import.meta.dirname, '../../../../docs/contracts/examples');

function example<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(EXAMPLES, file), 'utf8')) as T;
}

const device = () => example<GameProgress>('E-COM-2.device.progress.json');
const server = () => example<GameProgress>('E-COM-2.server.progress.json');
const consolidated = () => example<GameProgress>('E-COM-2.consolidated.progress.json');

const FIT_HEX: CatalogEntry = { gameId: 'hexa-fit', topology: 'hex' };
const CATALOG = {
  'fit-hex-001': FIT_HEX,
  'fit-hex-002': FIT_HEX,
  'fit-hex-003': FIT_HEX,
  'fit-hex-004': FIT_HEX,
  'fit-square-001': { gameId: 'hexa-fit', topology: 'square' },
  'sort-hex-001': { gameId: 'hexa-sort', topology: 'hex' },
  'sort-any-001': { gameId: 'hexa-sort', topology: 'any' },
} satisfies Record<string, CatalogEntry>;

const NOW = new Date('2026-11-25T12:00:00Z');

describe('API-03 · SyncProgressUseCase', () => {
  let transactions: InMemoryTransactionRunner;
  let schema: FakeProgressSchemaChecker;
  let catalog: InMemoryLevelCatalog;
  let sync: SyncProgressUseCase;

  function build(schemaChecker = new FakeProgressSchemaChecker()): SyncProgressUseCase {
    schema = schemaChecker;
    return new SyncProgressUseCase(
      schema,
      new PlausibilityPolicy(DEFAULT_SCORE_CAPS),
      catalog,
      transactions,
      new FakeClock(NOW),
    );
  }

  beforeEach(() => {
    transactions = new InMemoryTransactionRunner();
    catalog = new InMemoryLevelCatalog(CATALOG);
    sync = build();
  });

  describe('E-COM-2 · consolidating what was sent with what is stored (RN-COM-83, 84)', () => {
    it('should_store_the_consolidated_progress_when_the_device_sends_to_a_server_that_has_other_progress', async () => {
      // Arrange
      transactions.progress.set('user-1|hexa-fit', server());

      // Act
      await sync.execute({
        userId: 'user-1',
        gameId: 'hexa-fit',
        body: { sections: device().sections },
      });

      // Assert
      expect(transactions.progress.get('user-1|hexa-fit')).toEqual(consolidated());
    });

    it('should_answer_the_consolidated_value_of_what_was_sent_when_the_device_sends_all_its_levels', async () => {
      // Arrange
      transactions.progress.set('user-1|hexa-fit', server());

      // Act
      const result = await sync.execute({
        userId: 'user-1',
        gameId: 'hexa-fit',
        body: { sections: device().sections },
      });

      // Assert: the three levels of the device, consolidated; fit-hex-004 was not sent, so it is not answered
      const expected = consolidated();
      const levels = (expected.sections['hex'] as { levels: Record<string, unknown> }).levels;
      delete levels['fit-hex-004'];
      expect(result).toEqual(expected);
    });

    it('should_not_change_anything_when_the_same_progress_is_sent_twice', async () => {
      // Arrange
      transactions.progress.set('user-1|hexa-fit', server());
      const input = {
        userId: 'user-1',
        gameId: 'hexa-fit',
        body: { sections: device().sections },
      } as const;

      // Act
      const first = await sync.execute(input);
      const stored = structuredClone(transactions.progress.get('user-1|hexa-fit'));
      const second = await sync.execute(input);

      // Assert (RN-COM-84)
      expect(second).toEqual(first);
      expect(transactions.progress.get('user-1|hexa-fit')).toEqual(stored);
    });

    it('should_answer_only_the_level_that_was_sent_and_keep_the_rest_when_only_a_changed_level_is_sent (D-49)', async () => {
      // Arrange
      transactions.progress.set('user-1|hexa-fit', consolidated());
      const changed = example<{ sections: GameProgress['sections'] }>('sync.progress-update.json');

      // Act
      const result = await sync.execute({ userId: 'user-1', gameId: 'hexa-fit', body: changed });

      // Assert
      expect(Object.keys((result.sections['hex'] as { levels: object }).levels)).toEqual([
        'fit-hex-003',
      ]);
      expect(transactions.progress.get('user-1|hexa-fit')).toEqual(consolidated());
    });

    it('should_store_what_was_sent_when_the_user_has_no_progress_yet', async () => {
      // Act
      const result = await sync.execute({
        userId: 'user-1',
        gameId: 'hexa-fit',
        body: { sections: device().sections },
      });

      // Assert
      expect(result).toEqual(device());
      expect(transactions.progress.get('user-1|hexa-fit')).toEqual(device());
    });

    it('should_keep_the_better_stored_attempt_and_not_lower_it_when_the_device_sends_a_worse_one', async () => {
      // Arrange: the server has 3 stars in fit-hex-001, the device only 2
      transactions.progress.set('user-1|hexa-fit', server());

      // Act
      const result = await sync.execute({
        userId: 'user-1',
        gameId: 'hexa-fit',
        body: { sections: device().sections },
      });

      // Assert
      const levels = (result.sections['hex'] as { levels: Record<string, { stars: number }> })
        .levels;
      expect(levels['fit-hex-001']?.stars).toBe(3);
    });
  });

  describe('best attempts', () => {
    it('should_store_one_best_attempt_per_level_with_the_consolidated_values_when_a_sync_succeeds', async () => {
      // Arrange
      transactions.progress.set('user-1|hexa-fit', server());

      // Act
      await sync.execute({
        userId: 'user-1',
        gameId: 'hexa-fit',
        body: { sections: device().sections },
      });

      // Assert: the three levels that were sent, with the values that won
      const stored = transactions.bestAttempts.map(({ attempt }) => attempt);
      expect(stored.map((attempt) => attempt.levelId).sort()).toEqual([
        'fit-hex-001',
        'fit-hex-002',
        'fit-hex-003',
      ]);
      expect(stored.find((attempt) => attempt.levelId === 'fit-hex-001')).toEqual({
        gameId: 'hexa-fit',
        topology: 'hex',
        levelId: 'fit-hex-001',
        stars: 3,
        timeMs: 38000,
        moves: 3,
        achievedAt: '2026-11-09T20:00:00Z',
      });
    });

    it('should_store_the_record_with_an_empty_level_id_when_the_variant_has_no_levels', async () => {
      // Arrange
      const lines = example<GameProgress>('lines.progress.json');

      // Act
      await sync.execute({
        userId: 'user-1',
        gameId: 'hexa-lines',
        body: { sections: lines.sections },
      });

      // Assert
      const stored = transactions.bestAttempts.map(({ attempt }) => attempt);
      expect(stored).toHaveLength(2);
      expect(stored).toContainEqual({
        gameId: 'hexa-lines',
        topology: 'hex',
        levelId: '',
        score: 1240,
        achievedAt: '2026-11-12T18:30:00Z',
      });
    });

    it('should_not_duplicate_the_best_attempts_when_the_same_progress_is_sent_twice', async () => {
      // Arrange
      const input = {
        userId: 'user-1',
        gameId: 'hexa-fit',
        body: { sections: device().sections },
      } as const;

      // Act
      await sync.execute(input);
      await sync.execute(input);

      // Assert
      expect(transactions.bestAttempts).toHaveLength(3);
    });
  });

  describe('SEC-API-01 · the user is the one it was given', () => {
    it('should_lock_and_store_only_the_progress_of_the_user_it_was_given_when_two_users_sync', async () => {
      // Act
      await sync.execute({
        userId: 'user-1',
        gameId: 'hexa-fit',
        body: { sections: device().sections },
      });
      await sync.execute({
        userId: 'user-2',
        gameId: 'hexa-fit',
        body: { sections: server().sections },
      });

      // Assert
      expect(transactions.locked).toEqual([
        { userId: 'user-1', gameId: 'hexa-fit' },
        { userId: 'user-2', gameId: 'hexa-fit' },
      ]);
      expect(transactions.progress.get('user-1|hexa-fit')).toEqual(device());
      expect(transactions.progress.get('user-2|hexa-fit')).toEqual(server());
    });
  });

  describe('ARQ-04-API §3 step 1 · the shape of the body', () => {
    it('should_reject_with_the_errors_of_the_schema_and_do_nothing_when_the_body_breaks_the_update_schema', async () => {
      // Arrange
      sync = build(new FakeProgressSchemaChecker([{ pointer: '/sections', code: 'required' }]));

      // Act
      const attempt = sync.execute({ userId: 'user-1', gameId: 'hexa-fit', body: {} });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(ValidationError);
      await expect(attempt).rejects.toMatchObject({
        errors: [{ pointer: '/sections', code: 'required' }],
      });
      expect(transactions.runs).toBe(0);
    });

    it('should_check_the_shape_against_the_variant_of_the_route_when_the_body_is_valid', async () => {
      // Act
      await sync.execute({ userId: 'user-1', gameId: 'hexa-sort', body: { sections: {} } });

      // Assert
      expect(schema.gameProgresses).toEqual([{ gameId: 'hexa-sort', sections: {} }]);
    });

    it('should_reject_when_the_sections_do_not_have_the_shape_of_the_variant_of_the_route', async () => {
      // Arrange: Fit levels sent to the route of Hexa Lines
      sync = build(
        new FakeProgressSchemaChecker(
          [],
          [{ pointer: '/sections/hex/kind', code: 'invalid-value' }],
        ),
      );

      // Act
      const attempt = sync.execute({
        userId: 'user-1',
        gameId: 'hexa-lines',
        body: { sections: device().sections },
      });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(ValidationError);
      expect(transactions.runs).toBe(0);
    });

    it('should_not_check_the_variant_shape_when_the_update_schema_already_failed', async () => {
      // Arrange
      sync = build(new FakeProgressSchemaChecker([{ pointer: '', code: 'invalid-type' }]));

      // Act
      await sync.execute({ userId: 'user-1', gameId: 'hexa-fit', body: 7 }).catch(() => undefined);

      // Assert: the body is not an object, so there are no sections to put in a progress
      expect(schema.gameProgresses).toEqual([]);
    });
  });

  describe('RN-COM-108 · results that cannot happen', () => {
    it.each([
      ['stars out of range', 4],
      ['no stars', 0],
    ])(
      'should_reject_with_implausible_result_and_save_nothing_when_the_result_has_%s',
      async (_label, stars) => {
        // Arrange
        const body = { sections: device().sections };
        (body.sections['hex'] as { levels: Record<string, { stars: number }> }).levels[
          'fit-hex-001'
        ]!.stars = stars;

        // Act
        const attempt = sync.execute({ userId: 'user-1', gameId: 'hexa-fit', body });

        // Assert
        await expect(attempt).rejects.toBeInstanceOf(ImplausibleResultError);
        expect(transactions.runs).toBe(0);
        expect(transactions.progress.size).toBe(0);
      },
    );

    it('should_reject_when_the_result_is_dated_in_the_future', async () => {
      // Arrange
      const body = { sections: device().sections };
      (body.sections['hex'] as { levels: Record<string, { achievedAt: string }> }).levels[
        'fit-hex-002'
      ]!.achievedAt = '2026-11-25T13:00:00Z';

      // Act
      const attempt = sync.execute({ userId: 'user-1', gameId: 'hexa-fit', body });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(ImplausibleResultError);
    });

    it('should_reject_when_the_score_is_above_the_cap_of_the_variant', async () => {
      // Arrange
      const body = {
        sections: {
          hex: {
            kind: 'highScore',
            best: { score: 99_999_999, achievedAt: '2026-11-12T18:30:00Z' },
          },
        },
      };

      // Act
      const attempt = sync.execute({ userId: 'user-1', gameId: 'hexa-lines', body });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(ImplausibleResultError);
    });

    it('should_reject_when_a_level_does_not_exist', async () => {
      // Arrange
      const body = { sections: device().sections };
      (body.sections['hex'] as { levels: Record<string, unknown> }).levels['fit-hex-777'] = {
        stars: 1,
        timeMs: 1,
        moves: 1,
        achievedAt: '2026-11-10T14:12:00Z',
      };

      // Act
      const attempt = sync.execute({ userId: 'user-1', gameId: 'hexa-fit', body });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(ImplausibleResultError);
      expect(transactions.progress.size).toBe(0);
    });

    it('should_reject_when_a_level_belongs_to_another_variant', async () => {
      // Arrange: a Hexa Sort level among the Hexa Fit results (the shape check is a fake here)
      const body = {
        sections: {
          hex: {
            kind: 'levels',
            levels: {
              'sort-hex-001': { stars: 3, timeMs: 1, moves: 1, achievedAt: '2026-11-10T14:12:00Z' },
            },
          },
        },
      };

      // Act
      const attempt = sync.execute({ userId: 'user-1', gameId: 'hexa-fit', body });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(ImplausibleResultError);
    });

    it('should_reject_when_a_level_belongs_to_another_topology', async () => {
      // Arrange: fit-square-001 sent in the `hex` section
      const body = {
        sections: {
          hex: {
            kind: 'levels',
            levels: {
              'fit-square-001': {
                stars: 3,
                timeMs: 1,
                moves: 1,
                achievedAt: '2026-11-10T14:12:00Z',
              },
            },
          },
        },
      };

      // Act
      const attempt = sync.execute({ userId: 'user-1', gameId: 'hexa-fit', body });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(ImplausibleResultError);
    });

    it('should_accept_a_hexa_sort_level_of_topology_any_in_the_section_of_any_topology (RN-COM-75)', async () => {
      // Arrange
      const body = {
        sections: {
          square: {
            kind: 'levels',
            levels: {
              'sort-any-001': { moves: 6, score: 120, achievedAt: '2026-11-10T14:12:00Z' },
            },
          },
        },
      };

      // Act
      const result = await sync.execute({ userId: 'user-1', gameId: 'hexa-sort', body });

      // Assert
      expect(result.sections['square']).toBeDefined();
    });

    it('should_reject_a_hexa_fit_level_of_topology_any_when_it_is_sent_in_another_topology', async () => {
      // Arrange: the schema does not allow it, but a bad row in the catalog must not open the door (RN-COM-75)
      catalog = new InMemoryLevelCatalog({
        'fit-any-001': { gameId: 'hexa-fit', topology: 'any' },
      });
      sync = build();
      const body = {
        sections: {
          hex: {
            kind: 'levels',
            levels: {
              'fit-any-001': { stars: 3, timeMs: 1, moves: 1, achievedAt: '2026-11-10T14:12:00Z' },
            },
          },
        },
      };

      // Act
      const attempt = sync.execute({ userId: 'user-1', gameId: 'hexa-fit', body });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(ImplausibleResultError);
    });

    it('should_ask_the_catalog_once_for_all_the_levels_when_the_body_has_several_sections', async () => {
      // Act
      await sync.execute({
        userId: 'user-1',
        gameId: 'hexa-fit',
        body: { sections: device().sections },
      });

      // Assert
      expect(catalog.asked).toHaveLength(1);
      expect([...(catalog.asked[0] ?? [])].sort()).toEqual([
        'fit-hex-001',
        'fit-hex-002',
        'fit-hex-003',
      ]);
    });

    it('should_not_ask_the_catalog_when_the_variant_has_no_levels', async () => {
      // Act
      await sync.execute({
        userId: 'user-1',
        gameId: 'hexa-lines',
        body: { sections: example<GameProgress>('lines.progress.json').sections },
      });

      // Assert
      expect(catalog.asked).toEqual([]);
    });
  });
});
