import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/prisma/generated/client.js';

/**
 * PostgreSQL for the integration and e2e tests (D-57): the real engine, with the migrations already applied
 * (`npx prisma migrate deploy`). The URL comes from DATABASE_URL, the same variable the API reads.
 */
export function createTestPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString === '') {
    throw new Error('DATABASE_URL is required to run the integration and e2e tests');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Every test starts with an empty database and does not depend on the order of the others (tests.md). */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.bestAttempt.deleteMany();
  await prisma.progress.deleteMany();
  await prisma.level.deleteMany();
  await prisma.user.deleteMany();
}
