import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { FieldError } from '../domain/domain-error.js';
import { CONTRACT_DIR } from '../openapi/openapi-document.js';

// ajv-formats is CommonJS: under Node ESM the plugin is the default export or its `default` property.
const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ??
  addFormatsModule) as (ajv: Ajv2020) => void;

/** The `$id` of every schema of the contract is this folder plus its file name (`docs/contracts/schemas/`). */
export const CONTRACT_SCHEMA_BASE = 'https://hexablock-api.example/contracts/schemas/';

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
  propertyNames: 'invalid-key',
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

/** The most problems reported for one body; a body of 100 KB could have thousands. */
const MAX_ERRORS = 50;

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

/**
 * A check against a schema of the contract (`docs/contracts/schemas/`, the single source, D-23): the files are
 * read from the contract folder, which is copied next to the code in the image, and registered by their `$id`,
 * so nothing is fetched from the network (SEC-API-07). Every problem is a JSON Pointer and a `code`, never the
 * value that was sent.
 */
export class ContractSchemaValidator {
  private constructor(private readonly validate: ValidateFunction) {}

  /**
   * @param files the schema files that the checked schema refers to, and the checked one
   * @param reference the schema to check against: the `$id` of a file, or `$id#/$defs/<name>` for a part of it
   */
  static async create(
    files: readonly string[],
    reference: string,
  ): Promise<ContractSchemaValidator> {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    for (const file of files) {
      const schema = JSON.parse(
        await readFile(resolve(CONTRACT_DIR, 'schemas', file), 'utf8'),
      ) as object;
      ajv.addSchema(schema);
    }
    const validate = ajv.getSchema(`${CONTRACT_SCHEMA_BASE}${reference}`);
    if (validate === undefined) throw new Error(`Schema of the contract not found: ${reference}`);
    return new ContractSchemaValidator(validate);
  }

  /** The problems of `value`, without repeats and at most 50; empty when it is valid. */
  check(value: unknown): FieldError[] {
    if (this.validate(value)) return [];

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
