import { Module } from '@nestjs/common';
import { PrismaUserRepository } from './infrastructure/prisma-user-repository.js';
import { USER_REPOSITORY } from './users.tokens.js';

/**
 * Composition root of `users` (layer 4, ARQ-01-API §2): the `IUserRepository` port is wired to its Prisma
 * adapter and exported, so `auth` depends on the port and never on the adapter (ARQ-01-API §3).
 */
@Module({
  providers: [
    PrismaUserRepository,
    { provide: USER_REPOSITORY, useExisting: PrismaUserRepository },
  ],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
