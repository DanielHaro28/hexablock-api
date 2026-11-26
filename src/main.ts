import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { AppConfig } from './common/config/app-config.js';
import { APP_CONFIG } from './common/config/config.module.js';

/** Entry point (layer 4). Helmet, pipes, the error filter and Swagger are added with TEC-05. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port);
  new Logger('Bootstrap').log(`API listening on port ${config.port}`);
}

bootstrap().catch((error: unknown) => {
  // An invalid configuration lands here: the message names the variables and never their values.
  new Logger('Bootstrap').error(error instanceof Error ? error.message : 'Startup failed');
  process.exit(1);
});
