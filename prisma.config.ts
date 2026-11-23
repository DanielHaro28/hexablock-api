// Prisma ORM 7 configuration (D-89). Migrate (`prisma migrate dev|deploy`) reads the database URL from here.
import { defineConfig } from 'prisma/config';

// Locally the variables come from `.env` (never committed). In CI and in production they are already set,
// so a missing file is not an error.
try {
  process.loadEnvFile();
} catch {
  // no .env file
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // `prisma generate` does not connect, so it must not need the variable.
    url: process.env.DATABASE_URL ?? 'postgresql://unset:unset@localhost:5432/unset',
  },
});
