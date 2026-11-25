import type { IClock } from '../../../common/application/clock.js';
import type { UseCase } from '../../../common/application/use-case.js';
import { ImplausibleResultError, ValidationError } from '../../../common/domain/domain-error.js';
import type { ILevelCatalog } from '../../levels/application/level-catalog.js';
import type { PlausibilityPolicy } from '../domain/plausibility-policy.js';
import type {
  FitAttempt,
  GameId,
  GameProgress,
  LevelAttempt,
  Section,
  SortAttempt,
} from '../domain/progress.js';
import { ProgressConsolidator } from '../domain/progress-consolidator.js';
import type { IProgressSchemaChecker } from './progress-schema-checker.js';
import type { BestAttemptRecord, ITransactionRunner } from './transaction-runner.js';

export interface SyncProgressInput {
  /** Always the user of the JWT, never one from the URL or the body (SEC-API-01). */
  readonly userId: string;
  readonly gameId: GameId;
  /** The body as it arrived: it is validated here, not trusted. */
  readonly body: unknown;
}

/** The sections of a progress, to see what a request sent. */
type Sections = Readonly<Record<string, Section>>;

/**
 * API-03: the sync of the progress of one variant (RN-COM-83 to 86, D-49, ARQ-04-API §3). The body may hold every
 * result or only the ones that changed. In order:
 *
 * 1. the body fits `progressUpdate`, and its sections have the shape of the variant of the route (400);
 * 2. the results are plausible (RN-COM-108): stars, score, date, and every level exists for that variant and
 *    topology (400, nothing is saved);
 * 3. in one transaction, with the row of the user and variant locked, the stored progress is consolidated with
 *    what was sent, and the progress and the best attempts are saved;
 * 4. the answer is the consolidated value of what was sent, not of everything that is stored.
 */
export class SyncProgressUseCase implements UseCase<SyncProgressInput, GameProgress> {
  constructor(
    private readonly schema: IProgressSchemaChecker,
    private readonly plausibility: PlausibilityPolicy,
    private readonly catalog: ILevelCatalog,
    private readonly transactions: ITransactionRunner,
    private readonly clock: IClock,
  ) {}

  async execute(input: SyncProgressInput): Promise<GameProgress> {
    const sent = this.parse(input);

    if (!this.plausibility.isPlausible(input.gameId, sent.sections, this.clock.now())) {
      throw new ImplausibleResultError();
    }
    await this.checkLevelsExist(input.gameId, sent.sections);

    return this.transactions.run(async (unit) => {
      const stored = (await unit.lockProgress(input.userId, input.gameId)) ?? {
        gameId: input.gameId,
        sections: {},
      };
      const merged = ProgressConsolidator.consolidate(stored, sent);
      const answer = onlyWhatWasSent(merged, sent);

      await unit.saveProgress(input.userId, merged);
      await unit.saveBestAttempts(input.userId, bestAttemptsOf(answer));
      return answer;
    });
  }

  /** Step 1: the schema of the body, then the shape of every section for the variant of the route. */
  private parse(input: SyncProgressInput): GameProgress {
    const bodyErrors = this.schema.checkUpdate(input.body);
    if (bodyErrors.length > 0) throw new ValidationError(bodyErrors);

    const sent: GameProgress = {
      gameId: input.gameId,
      sections: (input.body as { sections: Sections }).sections,
    };
    const shapeErrors = this.schema.checkGameProgress(sent);
    if (shapeErrors.length > 0) throw new ValidationError(shapeErrors);
    return sent;
  }

  /** Step 2, the part that needs the catalog: a level of a result must be published for that variant and topology. */
  private async checkLevelsExist(gameId: GameId, sections: Sections): Promise<void> {
    const ids = new Set<string>();
    for (const section of Object.values(sections)) {
      if (section.kind === 'levels') Object.keys(section.levels).forEach((id) => ids.add(id));
    }
    if (ids.size === 0) return;

    const published = await this.catalog.findByIds([...ids]);
    for (const [topology, section] of Object.entries(sections)) {
      if (section.kind !== 'levels') continue;
      for (const id of Object.keys(section.levels)) {
        const level = published.get(id);
        // A Hexa Sort level of topology `any` is played with any topology (RN-COM-75)
        const sameTopology =
          level !== undefined &&
          (level.topology === topology || (gameId === 'hexa-sort' && level.topology === 'any'));
        if (level?.gameId !== gameId || !sameTopology) throw new ImplausibleResultError();
      }
    }
  }
}

/** The consolidated value of what was sent: the same sections, and in each one only the levels that were sent. */
function onlyWhatWasSent(merged: GameProgress, sent: GameProgress): GameProgress {
  const sections: Record<string, Section> = {};
  for (const [topology, sentSection] of Object.entries(sent.sections)) {
    const section = merged.sections[topology] as Section;
    if (section.kind === 'highScore' || sentSection.kind === 'highScore') {
      sections[topology] = section;
      continue;
    }
    sections[topology] = {
      kind: 'levels',
      levels: Object.fromEntries(
        Object.keys(sentSection.levels).map((id) => [
          id,
          (section as { levels: Record<string, LevelAttempt> }).levels[id] as LevelAttempt,
        ]),
      ),
    };
  }
  return { gameId: merged.gameId, sections };
}

/** The rows of `best_attempts` for a progress: one per level, or one per topology for a record (ARQ-04-API §2). */
function bestAttemptsOf(progress: GameProgress): BestAttemptRecord[] {
  const records: BestAttemptRecord[] = [];
  for (const [topology, section] of Object.entries(progress.sections)) {
    if (section.kind === 'highScore') {
      records.push({
        gameId: progress.gameId,
        topology,
        levelId: '',
        score: section.best.score,
        achievedAt: section.best.achievedAt,
      });
      continue;
    }
    for (const [levelId, attempt] of Object.entries(section.levels)) {
      records.push({
        gameId: progress.gameId,
        topology,
        levelId,
        ...(progress.gameId === 'hexa-fit'
          ? fitColumns(attempt as FitAttempt)
          : sortColumns(attempt as SortAttempt)),
        achievedAt: attempt.achievedAt,
      });
    }
  }
  return records;
}

function fitColumns(attempt: FitAttempt) {
  return { stars: attempt.stars, timeMs: attempt.timeMs, moves: attempt.moves };
}

function sortColumns(attempt: SortAttempt) {
  return { moves: attempt.moves, score: attempt.score };
}
