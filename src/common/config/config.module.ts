import { Global, Module } from '@nestjs/common';
import { type AppConfig, loadConfig } from './app-config.js';

/** Injection token of the validated configuration. */
export const APP_CONFIG = Symbol('APP_CONFIG');

/** Layer 4: reads `process.env` once at startup. An invalid environment stops the API here. */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: (): AppConfig => loadConfig(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
