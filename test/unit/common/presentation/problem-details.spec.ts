import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { CONTRACT_DIR } from '../../../../src/common/openapi/openapi-document.js';
import {
  buildProblem,
  MAX_FIELD_ERRORS,
  PROBLEM_CATALOG,
} from '../../../../src/common/presentation/problem-details.js';

const BASE = 'https://hexablock-api.example/problems/';
const CORRELATION_ID = '7f1c0e2a-4b9d-4c35-9e7a-2d1f0b6c8a11';

/** The `code` values of the contract: the catalog must answer every one of them. */
function contractCodes(): string[] {
  const schema = JSON.parse(
    readFileSync(resolve(CONTRACT_DIR, 'schemas/problem.schema.json'), 'utf8'),
  ) as { properties: { code: { enum: string[] } } };
  return schema.properties.code.enum;
}

describe('D-51 · Problem Details catalog', () => {
  it('should_have_one_entry_for_every_code_of_the_contract_when_the_catalog_is_compared_with_the_schema', () => {
    // Arrange
    const codes = contractCodes();

    // Act
    const catalogCodes = Object.keys(PROBLEM_CATALOG).sort();

    // Assert
    expect(catalogCodes).toEqual([...codes].sort());
  });

  it('should_keep_title_and_detail_within_the_limits_of_the_contract_when_every_entry_is_checked', () => {
    // Arrange / Act
    const entries = Object.values(PROBLEM_CATALOG);

    // Assert
    for (const { title, detail } of entries) {
      expect(title.length).toBeLessThanOrEqual(80);
      expect(detail.length).toBeLessThanOrEqual(200);
    }
  });

  it.each([
    ['validation-failed', 400],
    ['invalid-level', 400],
    ['implausible-result', 400],
    ['invalid-credentials', 401],
    ['unauthorized', 401],
    ['forbidden', 403],
    ['not-found', 404],
    ['email-taken', 409],
    ['display-name-taken', 409],
    ['level-exists', 409],
    ['stale-version', 409],
    ['payload-too-large', 413],
    ['too-many-requests', 429],
    ['internal-error', 500],
    ['service-unavailable', 503],
  ] as const)('should_answer_%s_with_status_%i_when_the_problem_is_built', (code, status) => {
    // Arrange / Act
    const problem = buildProblem(BASE, code, CORRELATION_ID);

    // Assert
    expect(problem.status).toBe(status);
  });

  it('should_reproduce_the_contract_example_when_display_name_taken_is_built', () => {
    // Arrange
    const example = JSON.parse(
      readFileSync(resolve(CONTRACT_DIR, 'examples/display-name-taken.problem.json'), 'utf8'),
    ) as unknown;

    // Act
    const problem = buildProblem(
      BASE,
      'display-name-taken',
      '7f1c0e2a-4b9d-4c35-9e7a-2d1f0b6c8a11',
    );

    // Assert
    expect(problem).toEqual(example);
  });

  it('should_build_type_from_the_base_uri_and_instance_from_the_correlation_id_when_a_problem_is_built', () => {
    // Arrange / Act
    const problem = buildProblem(BASE, 'not-found', CORRELATION_ID);

    // Assert
    expect(problem.type).toBe(`${BASE}not-found`);
    expect(problem.instance).toBe(`urn:uuid:${CORRELATION_ID}`);
    expect(problem.code).toBe('not-found');
  });

  it('should_include_field_errors_when_the_problem_is_a_400', () => {
    // Arrange
    const errors = [{ pointer: '/displayName', code: 'too-short' }];

    // Act
    const problem = buildProblem(BASE, 'validation-failed', CORRELATION_ID, errors);

    // Assert
    expect(problem.errors).toEqual(errors);
  });

  it('should_leave_out_field_errors_when_the_problem_is_not_a_400', () => {
    // Arrange
    const errors = [{ pointer: '/x', code: 'too-short' }];

    // Act
    const problem = buildProblem(BASE, 'not-found', CORRELATION_ID, errors);

    // Assert
    expect(problem).not.toHaveProperty('errors');
  });

  it('should_cap_field_errors_at_the_contract_limit_when_there_are_more_of_them', () => {
    // Arrange
    const errors = Array.from({ length: MAX_FIELD_ERRORS + 10 }, (_, index) => ({
      pointer: `/field${index}`,
      code: 'required',
    }));

    // Act
    const problem = buildProblem(BASE, 'validation-failed', CORRELATION_ID, errors);

    // Assert
    expect(problem.errors).toHaveLength(MAX_FIELD_ERRORS);
  });
});
