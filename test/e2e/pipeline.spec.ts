import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createContractChecker } from '../support/contract.js';
import { createTestApp } from '../support/test-app.js';

const PROBLEM_JSON = /^application\/problem\+json/;
const URN_UUID = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let app: NestExpressApplication;
let contract: Awaited<ReturnType<typeof createContractChecker>>;

beforeAll(async () => {
  app = await createTestApp();
  contract = await createContractChecker();
});

afterAll(async () => {
  await app.close();
});

/** Every error response of the API honours `problem.schema.json` and the media type of RFC 9457. */
function expectProblem(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
  expect(contract.problemErrors(response.body)).toEqual([]);
  expect((response.body as { code: string }).code).toBe(code);
}

describe('SEC-API-08 · errors are Problem Details without internals (D-51)', () => {
  it('should_not_include_stack_when_internal_error_occurs', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer()).get('/__probe/boom');

    // Assert
    expectProblem(response, 500, 'internal-error');
    const text = JSON.stringify(response.body);
    expect(text).not.toContain('stack');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('relation');
    expect(text).not.toContain('users');
  });

  it('should_answer_with_a_correlation_id_in_instance_when_an_error_occurs', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer()).get('/__probe/boom');

    // Assert
    expect((response.body as { instance: string }).instance).toMatch(URN_UUID);
  });

  it('should_use_a_different_instance_for_each_request_when_the_same_error_repeats', async () => {
    // Arrange
    const server = app.getHttpServer();

    // Act
    const first = await request(server).get('/__probe/boom');
    const second = await request(server).get('/__probe/boom');

    // Assert
    expect((first.body as { instance: string }).instance).not.toBe(
      (second.body as { instance: string }).instance,
    );
  });

  it('should_ignore_a_request_id_sent_by_the_client_when_building_the_instance', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer())
      .get('/__probe/boom')
      .set('X-Request-Id', 'client-chosen-id');

    // Assert
    expect(JSON.stringify(response.body)).not.toContain('client-chosen-id');
  });

  it('should_answer_401_with_a_bearer_challenge_when_no_token_is_valid', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer()).get('/__probe/unauthorized');

    // Assert
    expectProblem(response, 401, 'unauthorized');
    expect(response.headers['www-authenticate']).toBe('Bearer');
  });

  it('should_say_invalid_token_without_description_when_a_token_was_sent_but_is_not_valid', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer()).get('/__probe/invalid-token');

    // Assert
    expectProblem(response, 401, 'unauthorized');
    expect(response.headers['www-authenticate']).toBe('Bearer error="invalid_token"');
  });

  it('should_answer_401_with_a_bearer_challenge_when_the_credentials_are_wrong', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer()).get('/__probe/invalid-credentials');

    // Assert
    expectProblem(response, 401, 'invalid-credentials');
    expect(response.headers['www-authenticate']).toBe('Bearer');
  });

  it.each([
    ['/__probe/forbidden', 403, 'forbidden'],
    ['/__probe/not-found', 404, 'not-found'],
    ['/__probe/conflict', 409, 'email-taken'],
    ['/__probe/implausible', 400, 'implausible-result'],
  ])(
    'should_answer_%s_with_the_problem_%i_%s_when_the_use_case_throws',
    async (path, status, code) => {
      // Arrange / Act
      const response = await request(app.getHttpServer()).get(path);

      // Assert
      expectProblem(response, status, code);
    },
  );

  it('should_name_the_failed_rule_when_a_level_is_invalid', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer()).get('/__probe/invalid-level');

    // Assert
    expectProblem(response, 400, 'invalid-level');
    expect((response.body as { errors: unknown }).errors).toEqual([
      { pointer: '/variant/solution', code: 'rn-hf-12-d' },
    ]);
  });

  it('should_build_type_from_the_public_base_uri_when_an_error_occurs', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer()).get('/__probe/not-found');

    // Assert
    expect((response.body as { type: string }).type).toBe(
      'https://hexablock-api.example/problems/not-found',
    );
  });
});

describe('SEC-WEB-07 · the filter catches what the framework throws', () => {
  it('should_answer_not_found_without_the_framework_text_when_the_route_does_not_exist', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer()).get('/nowhere');

    // Assert
    expectProblem(response, 404, 'not-found');
    expect(JSON.stringify(response.body)).not.toContain('Cannot GET');
  });

  it('should_answer_400_without_the_text_of_the_parser_when_the_json_is_malformed', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer())
      .post('/__probe/echo')
      .set('Content-Type', 'application/json')
      .send('{"name": ');

    // Assert
    expectProblem(response, 400, 'validation-failed');
    expect((response.body as { errors: unknown }).errors).toEqual([
      { pointer: '', code: 'invalid-request' },
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(/Unexpected|JSON|position/);
  });
});

describe('SEC-API-04 · the body is limited to 100 KB', () => {
  it('should_answer_413_when_the_body_is_larger_than_100_kb', async () => {
    // Arrange
    const body = JSON.stringify({ name: 'x'.repeat(101 * 1024) });

    // Act
    const response = await request(app.getHttpServer())
      .post('/__probe/echo')
      .set('Content-Type', 'application/json')
      .send(body);

    // Assert
    expectProblem(response, 413, 'payload-too-large');
  });
});

describe('SEC-API-03 · validation rejects unknown fields and never echoes values', () => {
  it('should_answer_200_when_the_body_is_valid', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer()).post('/__probe/echo').send({ name: 'Ana' });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: 'Ana' });
  });

  it('should_answer_400_naming_the_field_when_the_body_contains_role', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer())
      .post('/__probe/echo')
      .send({ name: 'Ana', role: 'admin' });

    // Assert
    expectProblem(response, 400, 'validation-failed');
    expect((response.body as { errors: unknown }).errors).toEqual([
      { pointer: '/role', code: 'not-allowed' },
    ]);
    expect(JSON.stringify(response.body)).not.toContain('admin');
  });

  it('should_report_every_failed_field_with_its_rule_when_several_are_wrong', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer())
      .post('/__probe/echo')
      .send({ name: 'ab', count: -1 });

    // Assert
    expectProblem(response, 400, 'validation-failed');
    expect((response.body as { errors: unknown[] }).errors).toEqual(
      expect.arrayContaining([
        { pointer: '/name', code: 'too-short' },
        { pointer: '/count', code: 'too-small' },
      ]),
    );
  });

  it('should_not_repeat_the_submitted_value_when_a_field_is_invalid', async () => {
    // Arrange
    const secret = 'ab';

    // Act
    const response = await request(app.getHttpServer())
      .post('/__probe/echo')
      .send({ name: secret });

    // Assert
    expect(JSON.stringify(response.body)).not.toContain(`"${secret}"`);
  });
});

describe('SEC-API-08 · security headers', () => {
  it('should_send_the_helmet_headers_and_hide_the_framework_when_any_route_answers', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer()).get('/health');

    // Assert
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('should_not_allow_cross_origin_requests_when_a_browser_origin_is_sent', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://evil.example');

    // Assert
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
