import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { FieldError } from '../../../common/domain/domain-error.js';
import { CONTRACT_DIR } from '../../../common/openapi/openapi-document.js';
import type { ILevelSchemaChecker } from '../application/level-schema-checker.js';

// ajv-formats is CommonJS: under Node ESM the plugin is the default export or its `default` property.
const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ??
  addFormatsModule) as (ajv: Ajv2020) => void;

/** The `code` of each JSON Schema keyword that clients are expected to understand (D-51). */
const KEYWORD_CODES: Readonly<Record<string, string>> = {
  required: 'required',
  additionalProperties: 'not-allowed',
  not: 'not-allowed',
  type: 'invalid-type',
  enum: 'invalid-value',
  const: 'invalid-value',
  anyOf: 'invalid-value',
  oneOf: 'invalid-value',
  pattern: 'invalid-format',
  format: 'invalid-format',
  minLength: 'too-short',
  minItems: 'too-short',
  minProperties: 'too-short',
  maxLength: 'too-long',
  maxItems: 'too-long',
  maxProperties: 'too-long',
  minimum: 'too-small',
  exclusiveMinimum: 'too-small',
  maximum: 'too-large',
  exclusiveMaximum: 'too-large',
  uniqueItems: 'duplicate-item',
};

/** Ajv reports `if` after the real failure of its `then`: it adds nothing. */
const SKIPPED_KEYWORDS = new Set(['if']);

/** RFC 6901: `~` is `~0` and `/` is `~1` (Ajv already does it for the paths it builds). */
function escapePointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function kebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Turns an Ajv error into a field error. The submitted value is never copied (D-51, SEC-API-03). */
function toFieldError(error: ErrorObject): FieldError {
  let pointer = error.instancePath;
  // For these two the problem is a property, which Ajv gives in `params` and not in the path
  if (error.keyword === 'required') {
    pointer += `/${escapePointerSegment(String(error.params['missingProperty']))}`;
  } else if (error.keyword === 'additionalProperties') {
    pointer += `/${escapePointerSegment(String(error.params['additionalProperty']))}`;
  }
  return { pointer, code: KEYWORD_CODES[error.keyword] ?? kebabCase(error.keyword) };
}

/** The most problems reported for one level; a body of 100 KB could have thousands. */
const MAX_ERRORS = 50;

/**
 * Adapter of `ILevelSchemaChecker`: Ajv over `docs/contracts/schemas/level.schema.json`, the single source of
 * the contract (D-23), which is copied next to the code in the image. The schemas are read from the contract
 * folder and registered by their `$id`, so nothing is fetched from the network (SEC-API-07).
 */
export class AjvLevelSchemaChecker implements ILevelSchemaChecker {
  private constructor(private readonly validate: ValidateFunction) {}

  /** Reads and compiles the schema once; the checks that follow do not touch the disk. */
  static async create(): Promise<AjvLevelSchemaChecker> {
    const read = async (name: string): Promise<object> =>
      JSON.parse(await readFile(resolve(CONTRACT_DIR, 'schemas', name), 'utf8')) as object;

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    ajv.addSchema(await read('common.schema.json'));
    return new AjvLevelSchemaChecker(ajv.compile(await read('level.schema.json')));
  }

  check(level: unknown): FieldError[] {
    if (this.validate(level)) return [];

    const seen = new Set<string>();
    const errors: FieldError[] = [];
    for (const error of this.validate.errors ?? []) {
      if (SKIPPED_KEYWORDS.has(error.keyword)) continue;
      const fieldError = toFieldError(error);
      const key = `${fieldError.pointer}|${fieldError.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push(fieldError);
    }
    return errors.slice(0, MAX_ERRORS);
  }
}
