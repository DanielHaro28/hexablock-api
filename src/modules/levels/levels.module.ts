import { Module } from '@nestjs/common';
import type { ILevelRepository } from './application/level-repository.js';
import { ListLevelsUseCase } from './application/list-levels.use-case.js';
import { PrismaLevelRepository } from './infrastructure/prisma-level-repository.js';
import { LEVEL_REPOSITORY, LIST_LEVELS } from './levels.tokens.js';
import { LevelsController } from './presentation/levels.controller.js';

/** Composition root of `levels` (layer 4): the port is wired to its Prisma adapter, and the use case to the port. */
@Module({
  controllers: [LevelsController],
  providers: [
    PrismaLevelRepository,
    { provide: LEVEL_REPOSITORY, useExisting: PrismaLevelRepository },
    {
      provide: LIST_LEVELS,
      inject: [LEVEL_REPOSITORY],
      useFactory: (levels: ILevelRepository) => new ListLevelsUseCase(levels),
    },
  ],
  exports: [LEVEL_REPOSITORY],
})
export class LevelsModule {}
