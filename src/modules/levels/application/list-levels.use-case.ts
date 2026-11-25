import type { UseCase } from '../../../common/application/use-case.js';
import { ValidationError } from '../../../common/domain/domain-error.js';
import { LevelCursor } from '../domain/level-cursor.js';
import {
  type LevelGameId,
  type Topology,
  topologiesToDeliver,
} from '../domain/level-topologies.js';
import type { ILevelRepository, LevelDocument } from './level-repository.js';

export interface ListLevelsInput {
  readonly gameId: LevelGameId;
  readonly topology: Topology;
  /** What the previous page answered as `nextCursor`; none on the first download. */
  readonly cursor?: string;
  /** 1 to 100 (the contract). */
  readonly limit: number;
}

export interface LevelsPage {
  readonly levels: readonly LevelDocument[];
  readonly nextCursor: string;
}

/**
 * LVL-01: the levels of a variant and topology that were created or updated after a cursor, oldest change
 * first (RN-COM-77, D-48). Every answer has a `nextCursor`: the position of the last level of the page, or the
 * same cursor when nothing changed, so the app can always store what it received.
 */
export class ListLevelsUseCase implements UseCase<ListLevelsInput, LevelsPage> {
  constructor(private readonly levels: ILevelRepository) {}

  async execute(input: ListLevelsInput): Promise<LevelsPage> {
    const afterSeq =
      input.cursor === undefined ? LevelCursor.START : LevelCursor.decode(input.cursor);
    if (afterSeq === undefined) {
      throw new ValidationError([{ pointer: '/cursor', code: 'invalid-value' }]);
    }

    const changes = await this.levels.listChangedAfter({
      gameId: input.gameId,
      topologies: topologiesToDeliver(input.gameId, input.topology),
      afterSeq,
      limit: input.limit,
    });

    const last = changes.at(-1);
    return {
      levels: changes.map((change) => change.level),
      nextCursor: LevelCursor.encode(last?.changeSeq ?? afterSeq),
    };
  }
}
