import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AppConfig } from './common/config/app-config.js';
import { ConfigModule, APP_CONFIG } from './common/config/config.module.js';
import { AppThrottlerGuard } from './common/presentation/app-throttler-guard.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module.js';
import { LevelsModule } from './modules/levels/levels.module.js';
import { ProgressModule } from './modules/progress/progress.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

const ONE_MINUTE_MS = 60_000;

/** Root module (layer 4): the global providers and the business modules (ARQ-01-API §3). */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    // SEC-API-04: a limit on every route and a stricter one on login and register. Both count per IP and per minute.
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        // The guard answers with Problem Details and `Retry-After` itself (AppThrottlerGuard).
        setHeaders: false,
        throttlers: [
          { name: 'default', ttl: ONE_MINUTE_MS, limit: config.throttleLimit },
          {
            name: 'auth',
            ttl: ONE_MINUTE_MS,
            limit: config.throttleAuthLimit,
            skipIf: (context) =>
              !context.switchToHttp().getRequest<Request>().path.startsWith('/v1/auth/'),
          },
        ],
      }),
    }),
    AuthModule,
    UsersModule,
    ProgressModule,
    LeaderboardModule,
    LevelsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
