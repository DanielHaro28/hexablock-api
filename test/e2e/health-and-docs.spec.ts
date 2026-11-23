import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createContractChecker } from '../support/contract.js';
import { createTestApp } from '../support/test-app.js';

let contract: Awaited<ReturnType<typeof createContractChecker>>;

beforeAll(async () => {
  contract = await createContractChecker();
});

describe('RF-92 · GET /health', () => {
  let healthy: NestExpressApplication;
  let down: NestExpressApplication;

  beforeAll(async () => {
    healthy = await createTestApp({ databaseAvailable: true });
    down = await createTestApp({ databaseAvailable: false });
  });

  afterAll(async () => {
    await healthy.close();
    await down.close();
  });

  it('should_answer_200_ok_as_the_contract_says_when_the_database_is_available', async () => {
    // Arrange / Act
    const response = await request(healthy.getHttpServer()).get('/health');

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(
      contract.check('get', '/health', {
        status: response.status,
        headers: response.headers,
        body: response.body,
      }),
    ).toEqual([]);
  });

  it('should_answer_503_service_unavailable_as_the_contract_says_when_the_database_is_down', async () => {
    // Arrange / Act
    const response = await request(down.getHttpServer()).get('/health');

    // Assert
    expect(response.status).toBe(503);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect((response.body as { code: string }).code).toBe('service-unavailable');
    expect(
      contract.check('get', '/health', {
        status: response.status,
        headers: response.headers,
        body: response.body,
      }),
    ).toEqual([]);
  });

  it('should_not_prefix_health_with_v1_when_the_route_is_called', async () => {
    // Arrange / Act
    const response = await request(healthy.getHttpServer()).get('/v1/health');

    // Assert
    expect(response.status).toBe(404);
  });
});

describe('TEC-05 · Swagger in /docs is generated from openapi.yaml', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should_serve_every_route_of_the_contract_when_the_document_is_requested', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer()).get('/docs-json');

    // Assert
    expect(response.status).toBe(200);
    const document = response.body as { openapi: string; paths: Record<string, unknown> };
    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.paths).sort()).toEqual([...contract.paths].sort());
  });

  it('should_serve_swagger_ui_without_authentication_when_docs_is_requested', async () => {
    // Arrange / Act
    const response = await request(app.getHttpServer()).get('/docs/');

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
  });

  it('should_allow_inline_scripts_only_on_docs_when_the_policies_are_compared', async () => {
    // Arrange
    const server = app.getHttpServer();

    // Act
    const docs = await request(server).get('/docs/');
    const api = await request(server).get('/health');

    // Assert
    expect(docs.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
    expect(api.headers['content-security-policy']).toContain("script-src 'self';");
  });
});
