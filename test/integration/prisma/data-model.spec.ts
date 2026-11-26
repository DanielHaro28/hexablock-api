import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { PrismaClient } from '../../../src/prisma/generated/client.js';
import { createTestPrisma, truncateAll } from '../../support/test-database.js';

const prisma: PrismaClient = createTestPrisma();

const newUser = (email: string, displayName: string) => ({
  email,
  displayName,
  passwordHash: 'not-a-real-hash',
});

const newLevel = (id: string, order: number) => ({
  id,
  gameId: 'hexa-fit',
  topology: 'hex',
  order,
  version: 1,
  data: { sample: true },
});

/** Prisma error code of a rejected promise (P2002 = unique constraint). */
async function errorCodeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

describe('ARQ-04-API · data model (migration 0001)', () => {
  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('RN-COM-109 · email and display name are unique without regard to case', () => {
    it('should_reject_the_second_user_when_the_email_differs_only_in_case', async () => {
      // Arrange
      await prisma.user.create({ data: newUser('Ana@Example.com', 'Ana') });

      // Act
      const code = await errorCodeOf(
        prisma.user.create({ data: newUser('ana@example.com', 'Other name') }),
      );

      // Assert
      expect(code).toBe('P2002');
    });

    it('should_reject_the_second_user_when_the_display_name_differs_only_in_case', async () => {
      // Arrange
      await prisma.user.create({ data: newUser('one@example.com', 'Ana') });

      // Act
      const code = await errorCodeOf(
        prisma.user.create({ data: newUser('two@example.com', 'ANA') }),
      );

      // Assert
      expect(code).toBe('P2002');
    });

    it('should_create_users_with_the_user_role_when_no_role_is_given', async () => {
      // Arrange
      const data = newUser('ana@example.com', 'Ana');

      // Act
      const user = await prisma.user.create({ data });

      // Assert
      expect(user.role).toBe('USER');
    });
  });

  describe('ARQ-04-API §1 · best attempts', () => {
    it('should_reject_a_second_record_when_the_same_user_game_topology_and_empty_level_repeat', async () => {
      // Arrange
      const user = await prisma.user.create({ data: newUser('ana@example.com', 'Ana') });
      const record = {
        userId: user.id,
        gameId: 'hexa-lines',
        topology: 'hex',
        score: 100,
        achievedAt: new Date('2026-11-10T14:00:00Z'),
      };
      await prisma.bestAttempt.create({ data: record });

      // Act
      const code = await errorCodeOf(
        prisma.bestAttempt.create({ data: { ...record, score: 200 } }),
      );

      // Assert
      expect(code).toBe('P2002');
    });

    it('should_remove_progress_and_best_attempts_when_the_user_is_deleted', async () => {
      // Arrange
      const user = await prisma.user.create({ data: newUser('ana@example.com', 'Ana') });
      await prisma.progress.create({
        data: { userId: user.id, gameId: 'hexa-lines', sections: {} },
      });
      await prisma.bestAttempt.create({
        data: {
          userId: user.id,
          gameId: 'hexa-lines',
          topology: 'hex',
          score: 10,
          achievedAt: new Date('2026-11-10T14:00:00Z'),
        },
      });

      // Act
      await prisma.user.delete({ where: { id: user.id } });

      // Assert
      expect(await prisma.progress.count()).toBe(0);
      expect(await prisma.bestAttempt.count()).toBe(0);
    });
  });

  describe('D-48 · change_seq is the cursor of the level download', () => {
    it('should_give_a_higher_change_seq_to_each_new_level_when_levels_are_inserted_in_order', async () => {
      // Arrange
      const first = await prisma.level.create({ data: newLevel('fit-hex-001', 1) });

      // Act
      const second = await prisma.level.create({ data: newLevel('fit-hex-002', 2) });

      // Assert
      expect(second.changeSeq).toBeGreaterThan(first.changeSeq);
    });

    it('should_move_a_level_after_the_others_when_it_is_updated', async () => {
      // Arrange
      const first = await prisma.level.create({ data: newLevel('fit-hex-001', 1) });
      const second = await prisma.level.create({ data: newLevel('fit-hex-002', 2) });

      // Act
      const updated = await prisma.level.update({
        where: { id: first.id },
        data: { version: 2 },
      });

      // Assert
      expect(updated.changeSeq).toBeGreaterThan(second.changeSeq);
    });
  });
});
