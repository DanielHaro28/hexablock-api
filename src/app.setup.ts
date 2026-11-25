import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { AppConfig } from './common/config/app-config.js';
import { loadOpenApiDocument } from './common/openapi/openapi-document.js';
import { accessLogMiddleware } from './common/presentation/access-log.js';
import { correlationIdMiddleware } from './common/presentation/correlation-id.js';
import { GlobalExceptionFilter } from './common/presentation/global-exception-filter.js';
import { createValidationPipe } from './common/presentation/validation.js';

/** Largest request body (SEC-API-04). Bigger ones are a 413 `payload-too-large`. */
export const MAX_BODY_SIZE = '100kb';

/** Swagger UI needs inline scripts and styles, so `/docs` gets a looser policy than the API (SEC-API-08). */
const docsHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
});
const apiHelmet = helmet();

/**
 * Everything that is not a route (layer 4): the same setup for `main.ts` and for the tests, so the tests
 * exercise the real pipeline. Order matters: correlation id, access log, security headers, body limit, then the
 * global filter and pipe, then Swagger. CORS stays off: the mobile app does not need it (SEC-API-08).
 */
export async function configureApp(app: NestExpressApplication, config: AppConfig): Promise<void> {
  // Behind Caddy the client IP comes from X-Forwarded-For; without this every client would share one limit.
  if (config.trustProxyHops > 0) app.set('trust proxy', config.trustProxyHops);

  app.use(correlationIdMiddleware);
  app.use(accessLogMiddleware(new Logger('Access')));
  app.use((req: Request, res: Response, next: NextFunction) =>
    (req.path.toLowerCase().startsWith('/docs') ? docsHelmet : apiHelmet)(req, res, next),
  );
  app.useBodyParser('json', { limit: MAX_BODY_SIZE });

  app.useGlobalFilters(new GlobalExceptionFilter(config.problemBaseUri));
  app.useGlobalPipes(createValidationPipe());

  SwaggerModule.setup('docs', app, await loadOpenApiDocument(), {
    customSiteTitle: 'HexaBlock API',
  });
}
