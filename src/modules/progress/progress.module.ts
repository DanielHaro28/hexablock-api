import { Module } from '@nestjs/common';
import { GetProgressUseCase } from './application/get-progress.use-case.js';
import type { IProgressRepository } from './application/progress-repository.js';
import { PrismaProgressRepository } from './infrastructure/prisma-progress-repository.js';
import { ProgressController } from './presentation/progress.controller.js';
import { GET_PROGRESS, PROGRESS_REPOSITORY } from './progress.tokens.js';

/** Composition root of `progress` (layer 4): the port is wired to its Prisma adapter, and the use case to the port. */
@Module({
  controllers: [ProgressController],
  providers: [
    PrismaProgressRepository,
    { provide: PROGRESS_REPOSITORY, useExisting: PrismaProgressRepository },
    {
      provide: GET_PROGRESS,
      inject: [PROGRESS_REPOSITORY],
      useFactory: (progress: IProgressRepository) => new GetProgressUseCase(progress),
    },
  ],
})
export class ProgressModule {}
