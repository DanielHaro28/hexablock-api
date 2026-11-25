import { type FieldError, InvalidLevelError } from '../../../common/domain/domain-error.js';
import { type FitVariant, checkFitStructure } from '../domain/fit-level-rules.js';
import type { LevelGameId, LevelTopology, Topology } from '../domain/level-topologies.js';
import { type SortVariant, checkSortStructure } from '../domain/sort-level-rules.js';
import type { ILevelSchemaChecker } from './level-schema-checker.js';
import type { LevelDocument, ValidatedLevel } from './level-repository.js';

/** The shape of a level after the schema accepted it (`level.schema.json`). */
interface SchemaValidLevel {
  id: string;
  gameId: LevelGameId;
  topology: LevelTopology;
  order: number;
  version: number;
  variant: unknown;
}

/**
 * What the backend checks before it publishes a level (RN-COM-71, RN-COM-76, D-19): the schema first, and only
 * if the level fits it, the structural rules of its variant. The geometric rule RN-HF-12 f belongs to the
 * validator of the app. Anything wrong is an `InvalidLevelError` with every problem found.
 */
export class LevelValidator {
  constructor(private readonly schema: ILevelSchemaChecker) {}

  validate(input: unknown): ValidatedLevel {
    const schemaErrors = this.schema.check(input);
    if (schemaErrors.length > 0) throw new InvalidLevelError(schemaErrors);

    const level = input as SchemaValidLevel;
    const errors = [...this.checkId(level), ...this.checkStructure(level)];
    if (errors.length > 0) throw new InvalidLevelError(errors);

    return {
      id: level.id,
      gameId: level.gameId,
      topology: level.topology,
      order: level.order,
      version: level.version,
      document: input as LevelDocument,
    };
  }

  /** The id is `<variant>-<topology>-<nnn>` (D-47): the topology in it is the one of the level (RN-COM-70). */
  private checkId(level: SchemaValidLevel): FieldError[] {
    const topologyOfId = level.id.split('-')[1];
    return topologyOfId === level.topology ? [] : [{ pointer: '/id', code: 'rn-com-70-id' }];
  }

  private checkStructure(level: SchemaValidLevel): FieldError[] {
    return level.gameId === 'hexa-fit'
      ? checkFitStructure(level.topology as Topology, level.variant as FitVariant)
      : checkSortStructure(level.topology, level.variant as SortVariant);
  }
}
