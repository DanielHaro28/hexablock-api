import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import type { AppConfig } from '../common/config/app-config.js';
import { APP_CONFIG } from '../common/config/config.module.js';
import { PrismaClient } from './generated/client.js';

/**
 * The only connection to PostgreSQL (layer 4). Prisma ORM 7 talks to the database through a driver adapter
 * (D-89). Repositories in `infrastructure/` use this service; nothing else imports the Prisma client.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
