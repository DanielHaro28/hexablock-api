import { Module } from '@nestjs/common';
import type { ILevelRepository } from './application/level-repository.js';
import type { ILevelSchemaChecker } from './application/level-schema-checker.js';
import { LevelValidator } from './application/level-validator.js';
import { ListLevelsUseCase } from './application/list-levels.use-case.js';
import { UpsertLevelUseCase } from './application/upsert-level.use-case.js';
import { AjvLevelSchemaChecker } from './infrastructure/ajv-level-schema-checker.js';
import { PrismaLevelRepository } from './infrastructure/prisma-level-repository.js';
import {
  LEVEL_REPOSITORY,
  LEVEL_SCHEMA_CHECKER,
  LIST_LEVELS,
  UPSERT_LEVEL,
} from './levels.tokens.js';
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
    // The schema is read and compiled once, when the application starts
    { provide: LEVEL_SCHEMA_CHECKER, useFactory: () => AjvLevelSchemaChecker.create() },
    {
      provide: UPSERT_LEVEL,
      inject: [LEVEL_SCHEMA_CHECKER, LEVEL_REPOSITORY],
      useFactory: (schema: ILevelSchemaChecker, levels: ILevelRepository) =>
        new UpsertLevelUseCase(new LevelValidator(schema), levels),
    },
  ],
  exports: [LEVEL_REPOSITORY],
})
export class LevelsModule {}
