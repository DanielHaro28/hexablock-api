import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { AppConfig } from '../../../src/common/config/app-config.js';
import { ConflictError, NotFoundError } from '../../../src/common/domain/domain-error.js';
import type { ValidatedLevel } from '../../../src/modules/levels/application/level-repository.js';
import { PrismaLevelRepository } from '../../../src/modules/levels/infrastructure/prisma-level-repository.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { truncateAll } from '../../support/test-database.js';

const prisma = new PrismaService({ databaseUrl: process.env.DATABASE_URL ?? '' } as AppConfig);
const repository = new PrismaLevelRepository(prisma);

const EXAMPLES = resolve(import.meta.dirname, '../../../docs/contracts/examples');

function example(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(EXAMPLES, file), 'utf8')) as Record<string, unknown>;
}

/** Stores a level the way the publisher does: the row columns come from the JSON, `change_seq` from the database. */
async function store(level: Record<string, unknown>) {
  return prisma.level.create({
    data: {
      id: level['id'] as string,
      gameId: level['gameId'] as string,
      topology: level['topology'] as string,
      order: level['order'] as number,
      version: level['version'] as number,
      data: level as object,
    },
  });
}

const FIT_HEX_001 = example('E-HF-NIVEL.fit-hex-001.level.json');
const SORT_ANY_001 = example('sort-any-001.level.json');
const SORT_HEX_007 = example('sort-hex-007.level.json');

describe('LVL-01 · PrismaLevelRepository (PostgreSQL)', () => {
  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should_return_the_stored_level_document_when_the_level_is_published', async () => {
    // Arrange
    await store(FIT_HEX_001);

    // Act
    const changes = await repository.listChangedAfter({
      gameId: 'hexa-fit',
      topologies: ['hex'],
      afterSeq: 0n,
      limit: 100,
    });

    // Assert
    expect(changes).toHaveLength(1);
    expect(changes[0]?.level).toEqual(FIT_HEX_001);
    expect(typeof changes[0]?.changeSeq).toBe('bigint');
  });

  it('should_return_the_levels_in_the_order_they_were_published_when_there_are_several', async () => {
    // Arrange: published in the opposite order of their `order`
    await store(SORT_HEX_007);
    await store(SORT_ANY_001);

    // Act
    const changes = await repository.listChangedAfter({
      gameId: 'hexa-sort',
      topologies: ['hex', 'any'],
      afterSeq: 0n,
      limit: 100,
    });

    // Assert
    expect(changes.map((change) => change.level['id'])).toEqual(['sort-hex-007', 'sort-any-001']);
    expect(changes[0]!.changeSeq < changes[1]!.changeSeq).toBe(true);
  });

  it('should_filter_by_variant_and_topology_when_other_levels_are_published', async () => {
    // Arrange
    await store(FIT_HEX_001);
    await store(SORT_HEX_007);
    await store(SORT_ANY_001);

    // Act
    const fit = await repository.listChangedAfter({
      gameId: 'hexa-fit',
      topologies: ['hex'],
      afterSeq: 0n,
      limit: 100,
    });
    const sortSquare = await repository.listChangedAfter({
      gameId: 'hexa-sort',
      topologies: ['square', 'any'],
      afterSeq: 0n,
      limit: 100,
    });

    // Assert
    expect(fit.map((change) => change.level['id'])).toEqual(['fit-hex-001']);
    expect(sortSquare.map((change) => change.level['id'])).toEqual(['sort-any-001']);
  });

  it('should_return_only_the_levels_after_the_sequence_when_a_cursor_is_given', async () => {
    // Arrange
    const first = await store(SORT_HEX_007);
    await store(SORT_ANY_001);

    // Act
    const changes = await repository.listChangedAfter({
      gameId: 'hexa-sort',
      topologies: ['hex', 'any'],
      afterSeq: first.changeSeq,
      limit: 100,
    });

    // Assert
    expect(changes.map((change) => change.level['id'])).toEqual(['sort-any-001']);
  });

  it('should_return_at_most_the_limit_when_there_are_more_levels', async () => {
    // Arrange
    await store(SORT_HEX_007);
    await store(SORT_ANY_001);

    // Act
    const changes = await repository.listChangedAfter({
      gameId: 'hexa-sort',
      topologies: ['hex', 'any'],
      afterSeq: 0n,
      limit: 1,
    });

    // Assert
    expect(changes).toHaveLength(1);
  });

  it('should_return_a_level_again_after_its_cursor_when_it_was_updated (RN-COM-77)', async () => {
    // Arrange: the app downloaded both levels, then the first one is updated with a higher version
    const first = await store(SORT_HEX_007);
    const second = await store(SORT_ANY_001);
    await prisma.level.update({
      where: { id: 'sort-hex-007' },
      data: { version: 2, data: { ...SORT_HEX_007, version: 2 } },
    });

    // Act
    const changes = await repository.listChangedAfter({
      gameId: 'hexa-sort',
      topologies: ['hex', 'any'],
      afterSeq: second.changeSeq,
      limit: 100,
    });

    // Assert: the trigger gave the update a new, higher change number
    expect(changes.map((change) => change.level['id'])).toEqual(['sort-hex-007']);
    expect(changes[0]?.changeSeq).toBeGreaterThan(first.changeSeq);
    expect(changes[0]?.level['version']).toBe(2);
  });
});

/** A level as the use case hands it to the repository. */
function validated(
  level: Record<string, unknown>,
  version = level['version'] as number,
): ValidatedLevel {
  return {
    id: level['id'] as string,
    gameId: level['gameId'] as ValidatedLevel['gameId'],
    topology: level['topology'] as ValidatedLevel['topology'],
    order: level['order'] as number,
    version,
    document: { ...level, version },
  };
}

describe('LVL-02 · PrismaLevelRepository, publishing (PostgreSQL)', () => {
  beforeEach(async () => {
    await truncateAll(prisma);
  });

  it('should_store_the_level_and_return_it_in_the_download_when_it_is_created', async () => {
    // Act
    await repository.create(validated(FIT_HEX_001));

    // Assert
    const row = await prisma.level.findUniqueOrThrow({ where: { id: 'fit-hex-001' } });
    expect(row).toMatchObject({ gameId: 'hexa-fit', topology: 'hex', order: 1, version: 1 });
    expect(row.data).toEqual(FIT_HEX_001);
    const changes = await repository.listChangedAfter({
      gameId: 'hexa-fit',
      topologies: ['hex'],
      afterSeq: 0n,
      limit: 100,
    });
    expect(changes.map((change) => change.level['id'])).toEqual(['fit-hex-001']);
  });

  it('should_answer_level_exists_when_the_id_is_already_used', async () => {
    // Arrange
    await repository.create(validated(FIT_HEX_001));

    // Act
    const second = repository.create(validated(FIT_HEX_001, 5));

    // Assert
    await expect(second).rejects.toBeInstanceOf(ConflictError);
    await expect(second).rejects.toMatchObject({ code: 'level-exists' });
    expect((await prisma.level.findUniqueOrThrow({ where: { id: 'fit-hex-001' } })).version).toBe(
      1,
    );
  });

  it('should_create_only_one_level_when_two_requests_use_the_same_id_at_once', async () => {
    // Act
    const results = await Promise.allSettled([
      repository.create(validated(FIT_HEX_001)),
      repository.create(validated(FIT_HEX_001)),
    ]);

    // Assert
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'level-exists' },
    });
  });

  it('should_return_the_stored_version_when_the_level_exists_and_nothing_when_it_does_not', async () => {
    // Arrange
    await repository.create(validated(FIT_HEX_001, 3));

    // Act + Assert
    await expect(repository.findVersion('fit-hex-001')).resolves.toBe(3);
    await expect(repository.findVersion('fit-hex-999')).resolves.toBeUndefined();
  });

  it('should_replace_the_level_and_move_it_to_the_end_of_the_download_when_the_version_is_higher', async () => {
    // Arrange
    await repository.create(validated(SORT_HEX_007));
    await repository.create(validated(SORT_ANY_001));
    const before = await prisma.level.findUniqueOrThrow({ where: { id: 'sort-hex-007' } });

    // Act
    await repository.update(validated(SORT_HEX_007, 2));

    // Assert
    const after = await prisma.level.findUniqueOrThrow({ where: { id: 'sort-hex-007' } });
    expect(after.version).toBe(2);
    expect((after.data as Record<string, unknown>)['version']).toBe(2);
    expect(after.changeSeq).toBeGreaterThan(before.changeSeq);
    expect(after.publishedAt).toEqual(before.publishedAt);
  });

  it.each([1, 0])(
    'should_answer_stale_version_and_keep_the_level_when_the_version_is_%s',
    async (version) => {
      // Arrange
      await repository.create(validated(FIT_HEX_001, 1));

      // Act
      const attempt = repository.update(validated(FIT_HEX_001, version));

      // Assert
      await expect(attempt).rejects.toMatchObject({ code: 'stale-version' });
      expect((await prisma.level.findUniqueOrThrow({ where: { id: 'fit-hex-001' } })).version).toBe(
        1,
      );
    },
  );

  it('should_answer_not_found_when_the_level_does_not_exist', async () => {
    // Act
    const attempt = repository.update(validated(FIT_HEX_001, 2));

    // Assert
    await expect(attempt).rejects.toBeInstanceOf(NotFoundError);
  });

  it('should_accept_only_one_update_when_two_administrators_send_the_same_version_at_once', async () => {
    // Arrange
    await repository.create(validated(FIT_HEX_001, 1));

    // Act
    const results = await Promise.allSettled([
      repository.update(validated(FIT_HEX_001, 2)),
      repository.update(validated(FIT_HEX_001, 2)),
    ]);

    // Assert
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'stale-version' },
    });
  });
});
