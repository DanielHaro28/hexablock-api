import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { ConflictError } from '../../../src/common/domain/domain-error.js';
import { PrismaUserRepository } from '../../../src/modules/users/infrastructure/prisma-user-repository.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { AppConfig } from '../../../src/common/config/app-config.js';
import { truncateAll } from '../../support/test-database.js';

const prisma = new PrismaService({ databaseUrl: process.env.DATABASE_URL ?? '' } as AppConfig);
const repository = new PrismaUserRepository(prisma);

const ANA = { email: 'ana@example.com', passwordHash: '$argon2id$stub', displayName: 'AnaP' };

describe('API-01 · PrismaUserRepository (PostgreSQL)', () => {
  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should_store_the_account_with_the_user_role_when_it_is_created', async () => {
    // Act
    const user = await repository.create(ANA);

    // Assert
    expect(user).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown as string,
      email: 'ana@example.com',
      displayName: 'AnaP',
      role: 'USER',
    });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).toBe('$argon2id$stub');
    expect(row.role).toBe('USER');
  });

  it('should_answer_email_taken_when_the_email_exists_with_other_capitals', async () => {
    // Arrange
    await repository.create(ANA);

    // Act
    const second = repository.create({ ...ANA, email: 'ANA@Example.COM', displayName: 'Other' });

    // Assert
    await expect(second).rejects.toBeInstanceOf(ConflictError);
    await expect(second).rejects.toMatchObject({ code: 'email-taken' });
  });

  it('should_answer_display_name_taken_when_the_name_exists_with_other_capitals (RN-COM-109)', async () => {
    // Arrange
    await repository.create(ANA);

    // Act
    const second = repository.create({ ...ANA, email: 'other@example.com', displayName: 'anap' });

    // Assert
    await expect(second).rejects.toMatchObject({ code: 'display-name-taken' });
  });

  it('should_answer_email_taken_when_both_the_email_and_the_name_exist', async () => {
    // Arrange
    await repository.create(ANA);

    // Act
    const second = repository.create(ANA);

    // Assert
    await expect(second).rejects.toMatchObject({ code: 'email-taken' });
  });

  it('should_create_only_one_account_when_two_requests_use_the_same_email_at_once', async () => {
    // Act
    const results = await Promise.allSettled([
      repository.create({ ...ANA, displayName: 'First' }),
      repository.create({ ...ANA, displayName: 'Second' }),
    ]);

    // Assert
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({ reason: { code: 'email-taken' } });
    expect(await prisma.user.count()).toBe(1);
  });
});
