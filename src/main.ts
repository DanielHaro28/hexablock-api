import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { AppConfig } from './common/config/app-config.js';
import { APP_CONFIG } from './common/config/config.module.js';

/** Entry point (layer 4). The body parser is registered by `configureApp` with the size limit. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    // Startup errors reach the handler below, which prints one clean line instead of Nest's full trace.
    abortOnError: false,
  });
  app.enableShutdownHooks();

  const config = app.get<AppConfig>(APP_CONFIG);
  await configureApp(app, config);
  await app.listen(config.port);
  new Logger('Bootstrap').log(`API listening on port ${config.port}`);
}

bootstrap().catch((error: unknown) => {
  // An invalid configuration lands here: the message names the variables and never their values.
  new Logger('Bootstrap').error(error instanceof Error ? error.message : 'Startup failed');
  process.exit(1);
});
