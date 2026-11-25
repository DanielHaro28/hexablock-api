import { dereference } from '@apidevtools/json-schema-ref-parser';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import {
  CONTRACT_PARSER_OPTIONS,
  OPENAPI_FILE,
} from '../../src/common/openapi/openapi-document.js';

type Json = Record<string, unknown>;

// ajv-formats is CommonJS: under Node ESM the plugin is the default export or its `default` property.
const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ??
  addFormatsModule) as (ajv: Ajv2020) => void;

/** What a test needs to know about a response to check it against the contract. */
export interface ContractResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, unknown>>;
  readonly body: unknown;
}

/** Removes `$id` and `$schema` from the inlined schemas: the same file appears many times once dereferenced. */
function stripSchemaIdentity(node: unknown, seen = new Set<unknown>()): void {
  if (node === null || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  const object = node as Json;
  delete object['$id'];
  delete object['$schema'];
  for (const value of Object.values(object)) stripSchemaIdentity(value, seen);
}

/**
 * Checks real responses against `docs/contracts/openapi.yaml` (D-23, RNF-25): the status is declared for the
 * operation, the body validates against the schema of its media type, and the headers the contract requires are
 * there (`WWW-Authenticate` on 401, `Retry-After` on 429). The contract is the same file Swagger shows.
 */
export async function createContractChecker() {
  const document = (await dereference(OPENAPI_FILE, CONTRACT_PARSER_OPTIONS)) as unknown as Json;
  stripSchemaIdentity(document);

  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);

  const paths = document['paths'] as Record<string, Record<string, Json>>;

  /** Returns the list of differences; an empty list means the response honours the contract. */
  function check(
    method: 'get' | 'post' | 'put',
    pathTemplate: string,
    response: ContractResponse,
  ): string[] {
    const operation = paths[pathTemplate]?.[method];
    if (operation === undefined)
      return [`${method.toUpperCase()} ${pathTemplate} is not in the contract`];

    const declared = (operation['responses'] as Record<string, Json>)[String(response.status)];
    if (declared === undefined)
      return [`status ${response.status} is not declared for this operation`];

    const problems: string[] = [];

    for (const [name, header] of Object.entries(
      (declared['headers'] ?? {}) as Record<string, Json>,
    )) {
      const value = response.headers[name.toLowerCase()];
      if (value === undefined) {
        problems.push(`header ${name} is missing`);
        continue;
      }
      const pattern = (header['schema'] as Json | undefined)?.['pattern'];
      if (typeof pattern === 'string' && !new RegExp(pattern).test(String(value))) {
        problems.push(`header ${name} does not match ${pattern}`);
      }
    }

    const content = (declared['content'] ?? {}) as Record<string, Json>;
    const mediaType = Object.keys(content)[0];
    if (mediaType !== undefined) {
      const schema = content[mediaType]?.['schema'] as Json | undefined;
      if (schema !== undefined) {
        const validate = ajv.compile(schema);
        if (!validate(response.body)) {
          problems.push(
            ...(validate.errors ?? []).map(
              (error) => `${error.instancePath || '/'} ${error.message ?? ''}`,
            ),
          );
        }
      }
    }
    return problems;
  }

  /** Differences between a body and `problem.schema.json`: for the error routes that exist only in the tests. */
  function problemErrors(body: unknown): string[] {
    const declared = paths['/health']?.['get']?.['responses'] as Record<string, Json>;
    const content = declared['503']?.['content'] as Record<string, Json>;
    const schema = content['application/problem+json']?.['schema'] as Json;
    const validate = ajv.compile(schema);
    return validate(body)
      ? []
      : (validate.errors ?? []).map(
          (error) => `${error.instancePath || '/'} ${error.message ?? ''}`,
        );
  }

  return { check, problemErrors, paths: Object.keys(paths) };
}
