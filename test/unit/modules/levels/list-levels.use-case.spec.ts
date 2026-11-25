import { describe, expect, it } from '@jest/globals';
import { ValidationError } from '../../../../src/common/domain/domain-error.js';
import { ListLevelsUseCase } from '../../../../src/modules/levels/application/list-levels.use-case.js';
import { LevelCursor } from '../../../../src/modules/levels/domain/level-cursor.js';
import { InMemoryLevelRepository } from '../../../support/fake-level-repository.js';

function change(changeSeq: bigint, id: string, gameId = 'hexa-fit', topology = 'hex') {
  return { changeSeq, gameId, topology, level: { id, gameId, topology } };
}

const FIT_HEX = { gameId: 'hexa-fit', topology: 'hex', limit: 100 } as const;

describe('LVL-01 · ListLevelsUseCase', () => {
  describe('the first page (no cursor)', () => {
    it('should_return_every_level_of_the_variant_and_topology_when_there_is_no_cursor', async () => {
      // Arrange
      const repository = new InMemoryLevelRepository([
        change(1n, 'fit-hex-001'),
        change(2n, 'fit-hex-002'),
        change(3n, 'fit-square-001', 'hexa-fit', 'square'),
        change(4n, 'sort-hex-001', 'hexa-sort', 'hex'),
      ]);

      // Act
      const page = await new ListLevelsUseCase(repository).execute(FIT_HEX);

      // Assert
      expect(page.levels.map((level) => level['id'])).toEqual(['fit-hex-001', 'fit-hex-002']);
      expect(repository.queries[0]?.afterSeq).toBe(LevelCursor.START);
    });

    it('should_return_the_cursor_of_the_last_level_when_the_page_has_levels', async () => {
      // Arrange
      const repository = new InMemoryLevelRepository([
        change(5n, 'fit-hex-001'),
        change(9n, 'fit-hex-002'),
      ]);

      // Act
      const page = await new ListLevelsUseCase(repository).execute(FIT_HEX);

      // Assert
      expect(page.nextCursor).toBe(LevelCursor.encode(9n));
    });

    it('should_return_a_cursor_from_the_start_and_no_levels_when_nothing_was_published', async () => {
      // Act
      const page = await new ListLevelsUseCase(new InMemoryLevelRepository()).execute(FIT_HEX);

      // Assert
      expect(page.levels).toEqual([]);
      expect(page.nextCursor).toBe(LevelCursor.encode(0n));
    });
  });

  describe('with a cursor', () => {
    it('should_return_only_the_levels_changed_after_the_cursor_when_a_cursor_is_given', async () => {
      // Arrange
      const repository = new InMemoryLevelRepository([
        change(1n, 'fit-hex-001'),
        change(2n, 'fit-hex-002'),
        change(7n, 'fit-hex-003'),
      ]);

      // Act
      const page = await new ListLevelsUseCase(repository).execute({
        ...FIT_HEX,
        cursor: LevelCursor.encode(2n),
      });

      // Assert
      expect(page.levels.map((level) => level['id'])).toEqual(['fit-hex-003']);
      expect(page.nextCursor).toBe(LevelCursor.encode(7n));
    });

    it('should_return_an_empty_list_and_the_same_cursor_when_nothing_changed', async () => {
      // Arrange
      const repository = new InMemoryLevelRepository([change(1n, 'fit-hex-001')]);
      const cursor = LevelCursor.encode(1n);

      // Act
      const page = await new ListLevelsUseCase(repository).execute({ ...FIT_HEX, cursor });

      // Assert
      expect(page.levels).toEqual([]);
      expect(page.nextCursor).toBe(cursor);
    });

    it('should_return_a_level_again_when_it_was_updated_after_the_cursor', async () => {
      // Arrange: the same level, updated: it has a new, higher change number (RN-COM-77)
      const repository = new InMemoryLevelRepository([change(8n, 'fit-hex-001')]);

      // Act
      const page = await new ListLevelsUseCase(repository).execute({
        ...FIT_HEX,
        cursor: LevelCursor.encode(1n),
      });

      // Assert
      expect(page.levels.map((level) => level['id'])).toEqual(['fit-hex-001']);
    });
  });

  describe('RN-COM-75 · topologies', () => {
    it('should_ask_for_the_topology_and_any_when_the_variant_is_hexa_sort', async () => {
      // Arrange
      const repository = new InMemoryLevelRepository();

      // Act
      await new ListLevelsUseCase(repository).execute({
        gameId: 'hexa-sort',
        topology: 'square',
        limit: 100,
      });

      // Assert
      expect(repository.queries[0]?.topologies).toEqual(['square', 'any']);
    });

    it('should_return_a_sort_level_of_topology_any_when_the_app_asks_for_a_topology', async () => {
      // Arrange
      const repository = new InMemoryLevelRepository([
        change(1n, 'sort-any-001', 'hexa-sort', 'any'),
        change(2n, 'sort-hex-001', 'hexa-sort', 'hex'),
        change(3n, 'sort-square-001', 'hexa-sort', 'square'),
      ]);

      // Act
      const page = await new ListLevelsUseCase(repository).execute({
        gameId: 'hexa-sort',
        topology: 'hex',
        limit: 100,
      });

      // Assert
      expect(page.levels.map((level) => level['id'])).toEqual(['sort-any-001', 'sort-hex-001']);
    });
  });

  describe('paging', () => {
    it('should_return_at_most_the_limit_and_the_cursor_of_the_last_one_when_there_are_more_levels', async () => {
      // Arrange
      const repository = new InMemoryLevelRepository(
        [1n, 2n, 3n, 4n, 5n].map((seq) => change(seq, `fit-hex-00${seq}`)),
      );
      const list = new ListLevelsUseCase(repository);

      // Act
      const first = await list.execute({ ...FIT_HEX, limit: 2 });
      const second = await list.execute({ ...FIT_HEX, limit: 2, cursor: first.nextCursor });
      const third = await list.execute({ ...FIT_HEX, limit: 2, cursor: second.nextCursor });

      // Assert: every level arrives once, in order, and the last page is short
      const ids = [first, second, third].flatMap((page) => page.levels.map((level) => level['id']));
      expect(ids).toEqual([
        'fit-hex-001',
        'fit-hex-002',
        'fit-hex-003',
        'fit-hex-004',
        'fit-hex-005',
      ]);
      expect(third.levels).toHaveLength(1);
    });
  });

  describe('invalid cursor', () => {
    it('should_reject_with_a_validation_error_in_cursor_when_the_cursor_is_not_one_of_the_server', async () => {
      // Act
      const attempt = new ListLevelsUseCase(new InMemoryLevelRepository()).execute({
        ...FIT_HEX,
        cursor: 'garbage',
      });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(ValidationError);
      await expect(attempt).rejects.toMatchObject({
        errors: [{ pointer: '/cursor', code: 'invalid-value' }],
      });
    });
  });
});
