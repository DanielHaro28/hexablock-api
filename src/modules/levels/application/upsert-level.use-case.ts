import type { UseCase } from '../../../common/application/use-case.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/domain/domain-error.js';
import type { ILevelRepository, LevelDocument } from './level-repository.js';
import type { LevelValidator } from './level-validator.js';

export interface UpsertLevelInput {
  /** The body as it arrived: it is validated here, not trusted. */
  readonly level: unknown;
  /** The `id` of the route of a `PUT`; absent in a `POST`, which creates a level. */
  readonly pathId?: string;
}

/**
 * LVL-02: publishes a level (`POST`) or updates a published one (`PUT`), for administrators (SEC-API-05, the
 * route checks the role). The level is validated first, so a bad level is a 400 whatever else is wrong with the
 * request. A new level needs an id that is free (`level-exists`); an update needs a higher version
 * (`stale-version`), because the app keeps the one with the highest version (RN-COM-72). Levels are never deleted
 * (RN-COM-73, 74).
 */
export class UpsertLevelUseCase implements UseCase<UpsertLevelInput, LevelDocument> {
  constructor(
    private readonly validator: LevelValidator,
    private readonly levels: ILevelRepository,
  ) {}

  async execute(input: UpsertLevelInput): Promise<LevelDocument> {
    const level = this.validator.validate(input.level);

    if (input.pathId === undefined) {
      await this.levels.create(level);
      return level.document;
    }

    if (level.id !== input.pathId) {
      throw new ValidationError([{ pointer: '/id', code: 'id-mismatch' }]);
    }
    const stored = await this.levels.findVersion(level.id);
    if (stored === undefined) throw new NotFoundError();
    if (level.version <= stored) throw new ConflictError('stale-version');
    await this.levels.update(level);
    return level.document;
  }
}
