import type { UseCase } from '../../../common/application/use-case.js';
import type { GameProgress } from '../domain/progress.js';
import type { IProgressRepository } from './progress-repository.js';

export interface GetProgressInput {
  /** Always the user of the JWT, never one from the URL or the body (SEC-API-01). */
  readonly userId: string;
}

/** `allProgress` of the contract. */
export interface AllProgress {
  readonly games: readonly GameProgress[];
}

/**
 * API-03: the progress of every variant the user has, in every topology (RN-COM-90). The app downloads it when
 * the player logs in on a new device and consolidates it with its own.
 */
export class GetProgressUseCase implements UseCase<GetProgressInput, AllProgress> {
  constructor(private readonly progress: IProgressRepository) {}

  async execute(input: GetProgressInput): Promise<AllProgress> {
    return { games: await this.progress.findAllOf(input.userId) };
  }
}
