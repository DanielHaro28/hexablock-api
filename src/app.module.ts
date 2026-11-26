import { Module } from '@nestjs/common';
import { ConfigModule } from './common/config/config.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module.js';
import { LevelsModule } from './modules/levels/levels.module.js';
import { ProgressModule } from './modules/progress/progress.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

/** Root module (layer 4): the global providers and the business modules (ARQ-01-API §3). */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ProgressModule,
    LeaderboardModule,
    LevelsModule,
    HealthModule,
  ],
})
export class AppModule {}
