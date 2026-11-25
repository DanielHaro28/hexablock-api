import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { LevelGameId, Topology } from '../domain/level-topologies.js';

/** The query of `GET /v1/levels` (`gameId`, `topology`, `cursor` and `limit` of the contract). */
export class ListLevelsQuery {
  @IsIn(['hexa-fit', 'hexa-sort'])
  gameId!: LevelGameId;

  @IsIn(['hex', 'square', 'tri', 'cube'])
  topology!: Topology;

  /** Opaque: it is only the text of a previous `nextCursor`. The use case decides whether it is one. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[A-Za-z0-9_-]+$/)
  cursor?: string;

  /** Query parameters arrive as text, so `@Type` turns it into a number before it is validated. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
