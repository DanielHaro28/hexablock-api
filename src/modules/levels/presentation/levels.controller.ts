import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { UseCase } from '../../../common/application/use-case.js';
import { Public } from '../../../common/presentation/public.js';
import { Roles } from '../../auth/presentation/roles.decorator.js';
import type { LevelDocument } from '../application/level-repository.js';
import type { LevelsPage, ListLevelsInput } from '../application/list-levels.use-case.js';
import type { UpsertLevelInput } from '../application/upsert-level.use-case.js';
import { LIST_LEVELS, UPSERT_LEVEL } from '../levels.tokens.js';
import { ListLevelsQuery } from './list-levels.query.js';

/** The largest page (the contract); also the default. */
const DEFAULT_LIMIT = 100;

/**
 * Thin controller. The download is public and answers `LevelPage`; publishing and updating are for
 * administrators (SEC-API-05) and answer the level. The body of those two is validated by the level validator
 * against `level.schema.json`, not by a DTO, so it is received as it comes.
 */
@Controller('v1/levels')
export class LevelsController {
  constructor(
    @Inject(LIST_LEVELS) private readonly listLevels: UseCase<ListLevelsInput, LevelsPage>,
    @Inject(UPSERT_LEVEL) private readonly upsertLevel: UseCase<UpsertLevelInput, LevelDocument>,
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

  /** Publishes a new level. Administrators only (SEC-API-05); the answer says where it is. */
  @Roles('ADMIN')
  @Post()
  @HttpCode(201)
  async publish(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LevelDocument> {
    const level = await this.upsertLevel.execute({ level: body });
    // The id passed the schema (`^(fit|sort)-...`), so it is safe in a header
    response.setHeader('Location', `/v1/levels/${String(level['id'])}`);
    return level;
  }

  /** Updates a published level with a higher version. Administrators only (SEC-API-05). */
  @Roles('ADMIN')
  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown): Promise<LevelDocument> {
    return this.upsertLevel.execute({ level: body, pathId: id });
  }
}
