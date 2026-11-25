import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { AppConfig } from '../../../src/common/config/app-config.js';
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
