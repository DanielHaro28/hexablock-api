import { Controller, Get, Inject, Query } from '@nestjs/common';
import type { UseCase } from '../../../common/application/use-case.js';
import { Public } from '../../../common/presentation/public.js';
import type { LevelsPage, ListLevelsInput } from '../application/list-levels.use-case.js';
import { LIST_LEVELS } from '../levels.tokens.js';
import { ListLevelsQuery } from './list-levels.query.js';

/** The largest page (the contract); also the default. */
const DEFAULT_LIMIT = 100;

/** Thin controller: validates the query, calls the use case and answers `LevelPage` of the contract. */
@Controller('v1/levels')
export class LevelsController {
  constructor(
    @Inject(LIST_LEVELS) private readonly listLevels: UseCase<ListLevelsInput, LevelsPage>,
  ) {}

  /** Public: the app downloads levels before the player has an account (`openapi.yaml`, `listLevelChanges`). */
  @Public()
  @Get()
  list(@Query() query: ListLevelsQuery): Promise<LevelsPage> {
    return this.listLevels.execute({
      gameId: query.gameId,
      topology: query.topology,
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      limit: query.limit ?? DEFAULT_LIMIT,
    });
  }
}
