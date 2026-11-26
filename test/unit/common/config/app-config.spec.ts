import { describe, expect, it } from '@jest/globals';
import { ConfigError, loadConfig } from '../../../../src/common/config/app-config.js';

const SECRET = 'a-test-secret-with-more-than-32-bytes-0123456789';

/** A valid environment; each test changes only what it is about. */
const validEnv = (): Record<string, string | undefined> => ({
  NODE_ENV: 'test',
  PORT: '4000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5433/db',
  JWT_SECRET: SECRET,
  JWT_EXPIRES_IN_SECONDS: '3600',
  PROBLEM_BASE_URI: 'https://hexablock-api.example/problems/',
});

/** Runs `loadConfig` and returns the ConfigError it throws. */
function problemsOf(env: Record<string, string | undefined>): readonly string[] {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
  throw new Error('loadConfig did not throw');
}

describe('SEC-API-02 · configuration validated at startup (ARQ-01-API §7)', () => {
  it('should_return_the_typed_configuration_when_the_environment_is_valid', () => {
    // Arrange
    const env = validEnv();

    // Act
    const config = loadConfig(env);

    // Assert
    expect(config).toEqual({
      nodeEnv: 'test',
      port: 4000,
      databaseUrl: 'postgresql://user:pass@localhost:5433/db',
      jwtSecret: SECRET,
      jwtExpiresInSeconds: 3600,
      problemBaseUri: 'https://hexablock-api.example/problems/',
    });
  });

  it('should_use_the_defaults_when_optional_variables_are_missing', () => {
    // Arrange
    const env = validEnv();
    delete env.NODE_ENV;
    delete env.PORT;
    delete env.JWT_EXPIRES_IN_SECONDS;

    // Act
    const config = loadConfig(env);

    // Assert
    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.jwtExpiresInSeconds).toBe(86_400);
  });

  it.each(['DATABASE_URL', 'JWT_SECRET', 'PROBLEM_BASE_URI'])(
    'should_fail_naming_the_variable_when_%s_is_missing',
    (name) => {
      // Arrange
      const env = validEnv();
      delete env[name];

      // Act
      const problems = problemsOf(env);

      // Assert
      expect(problems).toEqual([`${name}: is required`]);
    },
  );

  it('should_treat_a_blank_variable_as_missing_when_it_has_only_spaces', () => {
    // Arrange
    const env = { ...validEnv(), JWT_SECRET: '   ' };

    // Act
    const problems = problemsOf(env);

    // Assert
    expect(problems).toEqual(['JWT_SECRET: is required']);
  });

  it('should_fail_when_the_jwt_secret_has_less_than_32_bytes', () => {
    // Arrange
    const env = { ...validEnv(), JWT_SECRET: 'too-short-secret' };

    // Act
    const problems = problemsOf(env);

    // Assert
    expect(problems).toEqual(['JWT_SECRET: must have at least 32 bytes (SEC-API-02)']);
  });

  it('should_never_include_the_secret_value_in_the_error_when_the_secret_is_rejected', () => {
    // Arrange
    const env = { ...validEnv(), JWT_SECRET: 'too-short-secret' };

    // Act
    let message = '';
    try {
      loadConfig(env);
    } catch (error) {
      message = (error as Error).message;
    }

    // Assert
    expect(message).not.toContain('too-short-secret');
  });

  it('should_fail_when_the_token_lifetime_is_longer_than_24_hours', () => {
    // Arrange
    const env = { ...validEnv(), JWT_EXPIRES_IN_SECONDS: '86401' };

    // Act
    const problems = problemsOf(env);

    // Assert
    expect(problems).toEqual(['JWT_EXPIRES_IN_SECONDS: must be an integer from 1 to 86400']);
  });

  it.each(['0', '65536', 'abc', '3000.5'])('should_fail_when_the_port_is_%s', (port) => {
    // Arrange
    const env = { ...validEnv(), PORT: port };

    // Act
    const problems = problemsOf(env);

    // Assert
    expect(problems).toEqual(['PORT: must be an integer from 1 to 65535']);
  });

  it('should_fail_when_the_database_url_is_not_postgresql', () => {
    // Arrange
    const env = { ...validEnv(), DATABASE_URL: 'mysql://user:pass@localhost/db' };

    // Act
    const problems = problemsOf(env);

    // Assert
    expect(problems).toEqual(['DATABASE_URL: must be a postgresql:// URL']);
  });

  it.each([
    'http://hexablock-api.example/problems/',
    'https://hexablock-api.example/problems',
    'x',
  ])('should_fail_when_the_problem_base_uri_is_%s', (uri) => {
    // Arrange
    const env = { ...validEnv(), PROBLEM_BASE_URI: uri };

    // Act
    const problems = problemsOf(env);

    // Assert
    expect(problems).toEqual(['PROBLEM_BASE_URI: must look like https://<public host>/problems/']);
  });

  it('should_fail_when_node_env_is_not_a_known_value', () => {
    // Arrange
    const env = { ...validEnv(), NODE_ENV: 'staging' };

    // Act
    const problems = problemsOf(env);

    // Assert
    expect(problems).toEqual(['NODE_ENV: must be one of development, test, production']);
  });

  it('should_report_every_problem_at_once_when_several_variables_are_invalid', () => {
    // Arrange
    const env = { ...validEnv(), PORT: '0', JWT_SECRET: undefined, DATABASE_URL: undefined };

    // Act
    const problems = problemsOf(env);

    // Assert
    expect(problems).toHaveLength(3);
  });
});
