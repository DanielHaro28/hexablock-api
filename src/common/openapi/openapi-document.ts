import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { bundle } from '@apidevtools/json-schema-ref-parser';
import type { OpenAPIObject } from '@nestjs/swagger';

/** `docs/contracts/` is the single source of the contract (D-23); it is copied next to the code in the image. */
export const CONTRACT_DIR = resolve(import.meta.dirname, '../../../docs/contracts');
export const OPENAPI_FILE = resolve(CONTRACT_DIR, 'openapi.yaml');

/**
 * The JSON schemas declare an absolute `$id` under this reserved example domain (RFC 2606), and the parser
 * resolves their references against it. The resolver below answers those URLs from `docs/contracts/`, so
 * nothing is ever fetched from the network (SEC-API-07).
 */
const CONTRACT_URL_PREFIX = 'https://hexablock-api.example/contracts/';

/** Options of the reference parser: local files only, and the contract URLs mapped to the contract folder. */
export const CONTRACT_PARSER_OPTIONS = {
  resolve: {
    http: false,
    contract: {
      order: 1,
      canRead: (file: { url: string }): boolean => file.url.startsWith(CONTRACT_URL_PREFIX),
      read: async (file: { url: string }): Promise<string> => {
        const relative = new URL(file.url).pathname.slice('/contracts/'.length);
        const target = resolve(CONTRACT_DIR, relative);
        // Never read outside the contract folder, whatever the reference says.
        if (!target.startsWith(CONTRACT_DIR + sep)) {
          throw new Error('Reference outside the contract folder');
        }
        return readFile(target, 'utf8');
      },
    },
  },
};

/**
 * Loads `openapi.yaml` as one self-contained document for Swagger UI (TEC-05): the references to the JSON
 * schemas are bundled, and the examples that point to a file (`externalValue`) are inlined, because the browser
 * cannot fetch relative files.
 */
export async function loadOpenApiDocument(file: string = OPENAPI_FILE): Promise<OpenAPIObject> {
  const document = (await bundle(file, CONTRACT_PARSER_OPTIONS)) as unknown as OpenAPIObject;
  await inlineExampleFiles(document, dirname(file));
  return document;
}

async function inlineExampleFiles(node: unknown, baseDir: string): Promise<void> {
  if (Array.isArray(node)) {
    for (const item of node) await inlineExampleFiles(item, baseDir);
    return;
  }
  if (node === null || typeof node !== 'object') return;

  const object = node as Record<string, unknown>;
  const external = object['externalValue'];
  if (typeof external === 'string') {
    object['value'] = JSON.parse(await readFile(resolve(baseDir, external), 'utf8')) as unknown;
    delete object['externalValue'];
  }
  for (const value of Object.values(object)) await inlineExampleFiles(value, baseDir);
}
