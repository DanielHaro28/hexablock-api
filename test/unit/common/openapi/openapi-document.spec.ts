import { describe, expect, it } from '@jest/globals';
import { loadOpenApiDocument } from '../../../../src/common/openapi/openapi-document.js';

describe('TEC-05 · Swagger is generated from openapi.yaml', () => {
  it('should_contain_every_route_of_the_contract_when_the_document_is_loaded', async () => {
    // Arrange / Act
    const document = await loadOpenApiDocument();

    // Assert
    expect(Object.keys(document.paths).sort()).toEqual(
      [
        '/health',
        '/v1/auth/login',
        '/v1/auth/register',
        '/v1/leaderboard/{gameId}',
        '/v1/levels',
        '/v1/levels/{id}',
        '/v1/me/progress',
        '/v1/me/progress/{gameId}',
      ].sort(),
    );
  });

  it('should_not_point_to_files_when_the_document_is_loaded', async () => {
    // Arrange / Act
    const document = JSON.stringify(await loadOpenApiDocument());

    // Assert: Swagger UI cannot fetch relative files, so every schema and example must be inside
    expect(document).not.toMatch(/\.\/schemas\//);
    expect(document).not.toContain('externalValue');
  });

  it('should_inline_the_example_files_when_an_operation_has_examples', async () => {
    // Arrange
    const document = await loadOpenApiDocument();

    // Act
    const conflict = document.paths['/v1/auth/register']?.post?.responses?.['409'] as unknown as {
      content: {
        'application/problem+json': { examples: { displayNameTaken: { value: { code: string } } } };
      };
    };

    // Assert
    expect(conflict.content['application/problem+json'].examples.displayNameTaken.value.code).toBe(
      'display-name-taken',
    );
  });
});
