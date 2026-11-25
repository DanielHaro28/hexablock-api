import { Logger, type Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import type { AppConfig } from '../../src/common/config/app-config.js';
import { APP_CONFIG } from '../../src/common/config/config.module.js';
import { HEALTH_PROBE } from '../../src/modules/health/health.tokens.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { FakeAuthController, ProbeController } from './probe.controllers.js';

const TEST_ENV: Readonly<Record<string, string>> = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://test:test@localhost:5433/test',
  JWT_SECRET: 'a-test-secret-with-more-than-32-bytes-0123456789',
  PROBLEM_BASE_URI: 'https://hexablock-api.example/problems/',
};

export interface TestAppOptions {
  /** Overrides of the environment, e.g. a low `THROTTLE_AUTH_LIMIT` to test rate limiting. */
  readonly env?: Readonly<Record<string, string>>;
  /**
   * Use the real PostgreSQL of `DATABASE_URL` instead of a stub (for the routes that store data). The tests
   * that set it start from an empty database (`truncateAll`). Default: no database.
   */
  readonly database?: boolean;
  /** What the health probe answers. Default: the database is available. */
  readonly databaseAvailable?: boolean;
  /** Routes that exist only in the test. Default: the probe controllers. */
  readonly controllers?: Type[];
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is required for the e2e tests that use the database');
  }
  return url;
}

/**
 * The real application, with the real global pipeline (`configureApp`), but without a database: Prisma is a
 * stub and the health probe answers what the test says (D-56: fakes written by hand). For tests that need
 * PostgreSQL use `createTestPrisma`.
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<NestExpressApplication> {
  Logger.overrideLogger(false);

  // The configuration reads process.env while the module is built; the environment is restored right after.
  const overrides = {
    ...TEST_ENV,
    ...(options.database === true ? { DATABASE_URL: requireDatabaseUrl() } : {}),
    ...options.env,
  };
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  Object.assign(process.env, overrides);

  try {
    const builder = Test.createTestingModule({
      imports: [AppModule],
      controllers: options.controllers ?? [ProbeController, FakeAuthController],
    });
    if (options.database !== true) {
      builder
        .overrideProvider(PrismaService)
        .useValue({ onModuleInit: () => undefined, onModuleDestroy: () => undefined });
    }
    const moduleRef = await builder
      .overrideProvider(HEALTH_PROBE)
      .useValue({ isDatabaseAvailable: () => Promise.resolve(options.databaseAvailable ?? true) })
      .compile();

    const app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      logger: false,
    });
    await configureApp(app, app.get<AppConfig>(APP_CONFIG));
    await app.init();
    return app;
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
