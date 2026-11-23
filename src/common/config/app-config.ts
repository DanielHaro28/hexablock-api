/**
 * Configuration read from environment variables and validated at startup (ARQ-01-API §7): when a variable is
 * missing or invalid the API does not start. Errors name the variable, never its value (JWT_SECRET, passwords).
 */

export type NodeEnv = 'development' | 'test' | 'production';

export interface AppConfig {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
  readonly databaseUrl: string;
  /** HS256 secret, at least 32 bytes (SEC-API-02). */
  readonly jwtSecret: string;
  /** Lifetime of the access token, at most 24 h (D-44). */
  readonly jwtExpiresInSeconds: number;
  /** Public base URI of the problem types: `type` = this + `code` (D-51). */
  readonly problemBaseUri: string;
}

export const MIN_JWT_SECRET_BYTES = 32;
export const MAX_JWT_LIFETIME_SECONDS = 86_400;

const NODE_ENVS: readonly NodeEnv[] = ['development', 'test', 'production'];
const PROBLEM_BASE_URI_PATTERN = /^https:\/\/[^/\s]+\/problems\/$/;

/** Thrown when the environment is not valid. `problems` lists "NAME: reason" lines without values. */
export class ConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid configuration:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const problems: string[] = [];

  const text = (name: string): string | undefined => {
    const value = env[name]?.trim();
    return value === undefined || value === '' ? undefined : value;
  };
  const required = (name: string): string => {
    const value = text(name);
    if (value === undefined) problems.push(`${name}: is required`);
    return value ?? '';
  };
  const integer = (name: string, fallback: number, min: number, max: number): number => {
    const raw = text(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
      problems.push(`${name}: must be an integer from ${min} to ${max}`);
      return fallback;
    }
    return value;
  };

  const nodeEnvRaw = text('NODE_ENV') ?? 'development';
  if (!NODE_ENVS.includes(nodeEnvRaw as NodeEnv)) {
    problems.push(`NODE_ENV: must be one of ${NODE_ENVS.join(', ')}`);
  }

  const port = integer('PORT', 3000, 1, 65_535);

  const databaseUrl = required('DATABASE_URL');
  if (databaseUrl !== '' && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    problems.push('DATABASE_URL: must be a postgresql:// URL');
  }

  const jwtSecret = required('JWT_SECRET');
  if (jwtSecret !== '' && Buffer.byteLength(jwtSecret, 'utf8') < MIN_JWT_SECRET_BYTES) {
    problems.push(`JWT_SECRET: must have at least ${MIN_JWT_SECRET_BYTES} bytes (SEC-API-02)`);
  }

  const jwtExpiresInSeconds = integer(
    'JWT_EXPIRES_IN_SECONDS',
    MAX_JWT_LIFETIME_SECONDS,
    1,
    MAX_JWT_LIFETIME_SECONDS,
  );

  const problemBaseUri = required('PROBLEM_BASE_URI');
  if (problemBaseUri !== '' && !PROBLEM_BASE_URI_PATTERN.test(problemBaseUri)) {
    problems.push('PROBLEM_BASE_URI: must look like https://<public host>/problems/');
  }

  if (problems.length > 0) throw new ConfigError(problems);

  return {
    nodeEnv: nodeEnvRaw as NodeEnv,
    port,
    databaseUrl,
    jwtSecret,
    jwtExpiresInSeconds,
    problemBaseUri,
  };
}
