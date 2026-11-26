import { Module } from '@nestjs/common';

/**
 * Composition root of the `leaderboard` module (layer 4, ARQ-01-API §2): the place where ports are wired to their
 * implementations. It stays empty until the module's first story (ARQ-03-API §3).
 */
@Module({})
export class LeaderboardModule {}
