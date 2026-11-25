import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { AppConfig } from '../../../src/common/config/app-config.js';
import { PrismaLevelCatalog } from '../../../src/modules/levels/infrastructure/prisma-level-catalog.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { truncateAll } from '../../support/test-database.js';

const prisma = new PrismaService({ databaseUrl: process.env.DATABASE_URL ?? '' } as AppConfig);
const catalog = new PrismaLevelCatalog(prisma);

async function publish(id: string, gameId: string, topology: string): Promise<void> {
  await prisma.level.create({ data: { id, gameId, topology, order: 1, version: 1, data: { id } } });
}

describe('RN-COM-108 · PrismaLevelCatalog (PostgreSQL)', () => {
  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should_return_the_variant_and_topology_of_the_published_levels_when_their_ids_are_asked', async () => {
    // Arrange
    await publish('fit-hex-001', 'hexa-fit', 'hex');
    await publish('sort-any-001', 'hexa-sort', 'any');

    // Act
    const found = await catalog.findByIds(['fit-hex-001', 'sort-any-001']);

    // Assert
    expect(found.get('fit-hex-001')).toEqual({ gameId: 'hexa-fit', topology: 'hex' });
    expect(found.get('sort-any-001')).toEqual({ gameId: 'hexa-sort', topology: 'any' });
  });

  it('should_leave_out_the_ids_that_are_not_published_when_some_are_unknown', async () => {
    // Arrange
    await publish('fit-hex-001', 'hexa-fit', 'hex');

    // Act
    const found = await catalog.findByIds(['fit-hex-001', 'fit-hex-999']);

    // Assert
    expect([...found.keys()]).toEqual(['fit-hex-001']);
  });

  it('should_not_return_the_levels_that_were_not_asked_when_others_are_published', async () => {
    // Arrange
    await publish('fit-hex-001', 'hexa-fit', 'hex');
    await publish('fit-hex-002', 'hexa-fit', 'hex');

    // Act
    const found = await catalog.findByIds(['fit-hex-002']);

    // Assert
    expect([...found.keys()]).toEqual(['fit-hex-002']);
  });

  it('should_answer_an_empty_map_when_no_id_is_asked', async () => {
    // Act
    const found = await catalog.findByIds([]);

    // Assert
    expect(found.size).toBe(0);
  });
});
