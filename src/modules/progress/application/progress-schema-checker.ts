import type { FieldError } from '../../../common/domain/domain-error.js';

/**
 * Port of the schema checks of a sync (ARQ-04-API §3 step 1). The adapter uses the schemas of the contract, so
 * the app and the API accept the same bodies (D-23).
 */
export interface IProgressSchemaChecker {
  /** The body of `PUT /v1/me/progress/{gameId}` against `progressUpdate`. */
  checkUpdate(body: unknown): FieldError[];

  /**
   * The progress that results from putting the `gameId` of the route over the sections of the body, against
   * `gameProgress`: that is what checks that the shape of every section is the one of the variant (a `highScore`
   * for Lines and Merge, attempts of Fit or Sort for the others).
   */
  checkGameProgress(progress: unknown): FieldError[];
}
