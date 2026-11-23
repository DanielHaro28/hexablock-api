import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import {
  ConflictError,
  ForbiddenError,
  ImplausibleResultError,
  InvalidCredentialsError,
  InvalidLevelError,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from '../../../../src/common/domain/domain-error.js';
import { mapException } from '../../../../src/common/presentation/exception-mapper.js';

/** An error like the ones body-parser raises (`http-errors`): a status and a `type`, no Nest class. */
function bodyParserError(status: number, type: string): Error {
  return Object.assign(new Error('Unexpected token } in JSON at position 17'), { status, type });
}

describe('D-51 · every error becomes a problem of the contract (ARQ-03-API §2)', () => {
  describe('typed errors of the domain', () => {
    it.each([
      ['ValidationError', new ValidationError(), 'validation-failed'],
      ['InvalidLevelError', new InvalidLevelError(), 'invalid-level'],
      ['ImplausibleResultError', new ImplausibleResultError(), 'implausible-result'],
      ['ForbiddenError', new ForbiddenError(), 'forbidden'],
      ['NotFoundError', new NotFoundError(), 'not-found'],
      ['ServiceUnavailableError', new ServiceUnavailableError(), 'service-unavailable'],
      ['ConflictError (email)', new ConflictError('email-taken'), 'email-taken'],
      ['ConflictError (name)', new ConflictError('display-name-taken'), 'display-name-taken'],
      ['ConflictError (exists)', new ConflictError('level-exists'), 'level-exists'],
      ['ConflictError (stale)', new ConflictError('stale-version'), 'stale-version'],
    ])('should_map_%s_to_%s_when_it_is_thrown', (_name, error, code) => {
      // Arrange / Act
      const mapped = mapException(error);

      // Assert
      expect(mapped.code).toBe(code);
      expect(mapped.unexpected).toBeUndefined();
    });

    it('should_keep_the_field_errors_when_a_validation_error_carries_them', () => {
      // Arrange
      const errors = [{ pointer: '/password', code: 'too-short' }];

      // Act
      const mapped = mapException(new ValidationError(errors));

      // Assert
      expect(mapped.errors).toEqual(errors);
    });

    it('should_keep_the_failed_rule_when_a_level_is_invalid', () => {
      // Arrange
      const errors = [{ pointer: '/variant/solution', code: 'rn-hf-12-d' }];

      // Act
      const mapped = mapException(new InvalidLevelError(errors));

      // Assert
      expect(mapped.errors).toEqual(errors);
    });

    it('should_ask_for_a_bearer_token_when_no_token_was_sent', () => {
      // Arrange / Act
      const mapped = mapException(new UnauthorizedError());

      // Assert
      expect(mapped.headers).toEqual({ 'WWW-Authenticate': 'Bearer' });
    });

    it('should_say_invalid_token_without_a_description_when_the_token_is_expired_or_altered', () => {
      // Arrange / Act
      const mapped = mapException(new UnauthorizedError(true));

      // Assert
      expect(mapped.headers).toEqual({ 'WWW-Authenticate': 'Bearer error="invalid_token"' });
    });

    it('should_ask_for_a_bearer_token_when_the_credentials_are_wrong', () => {
      // Arrange / Act
      const mapped = mapException(new InvalidCredentialsError());

      // Assert
      expect(mapped.code).toBe('invalid-credentials');
      expect(mapped.headers).toEqual({ 'WWW-Authenticate': 'Bearer' });
    });

    it('should_send_retry_after_in_seconds_when_the_limit_is_exceeded', () => {
      // Arrange / Act
      const mapped = mapException(new TooManyRequestsError(42));

      // Assert
      expect(mapped.code).toBe('too-many-requests');
      expect(mapped.headers).toEqual({ 'Retry-After': '42' });
    });
  });

  describe('errors of the framework and of the body parser (CWE-211, SEC-WEB-07)', () => {
    it('should_map_malformed_json_to_a_400_without_the_text_of_the_parser_when_the_body_cannot_be_read', () => {
      // Arrange
      const error = bodyParserError(400, 'entity.parse.failed');

      // Act
      const mapped = mapException(error);

      // Assert
      expect(mapped.code).toBe('validation-failed');
      expect(mapped.errors).toEqual([{ pointer: '', code: 'invalid-request' }]);
      expect(JSON.stringify(mapped)).not.toContain('Unexpected token');
    });

    it('should_map_a_body_over_the_limit_to_payload_too_large_when_body_parser_rejects_it', () => {
      // Arrange
      const error = bodyParserError(413, 'entity.too.large');

      // Act
      const mapped = mapException(error);

      // Assert
      expect(mapped.code).toBe('payload-too-large');
    });

    it('should_map_an_unknown_route_to_not_found_when_nest_raises_a_404', () => {
      // Arrange
      const error = new NotFoundException('Cannot GET /nowhere');

      // Act
      const mapped = mapException(error);

      // Assert
      expect(mapped.code).toBe('not-found');
      expect(JSON.stringify(mapped)).not.toContain('Cannot GET');
    });

    it('should_map_a_nest_bad_request_to_validation_failed_when_it_has_no_specific_field', () => {
      // Arrange
      const error = new BadRequestException('Validation failed (uuid is expected)');

      // Act
      const mapped = mapException(error);

      // Assert
      expect(mapped.code).toBe('validation-failed');
      expect(mapped.errors).toEqual([{ pointer: '', code: 'invalid-request' }]);
    });

    it('should_map_a_429_http_exception_to_too_many_requests_when_a_library_raises_it', () => {
      // Arrange / Act
      const mapped = mapException(new HttpException('ThrottlerException: Too Many Requests', 429));

      // Assert
      expect(mapped.code).toBe('too-many-requests');
      expect(Number(mapped.headers['Retry-After'])).toBeGreaterThanOrEqual(1);
    });
  });

  describe('SEC-WEB-07 · it fails closed: anything unknown is an internal error', () => {
    it.each([
      ['an Error', new Error('relation "users" does not exist')],
      ['a string', 'boom'],
      ['null', null],
      ['undefined', undefined],
      ['a plain object', { status: 'nope' }],
    ])('should_map_%s_to_internal_error_when_it_is_thrown', (_name, thrown) => {
      // Arrange / Act
      const mapped = mapException(thrown);

      // Assert
      expect(mapped.code).toBe('internal-error');
      expect(mapped.unexpected).toBe(thrown);
    });

    it('should_log_the_error_with_its_stack_when_the_framework_raises_a_5xx', () => {
      // Arrange
      const error = bodyParserError(502, 'whatever');

      // Act
      const mapped = mapException(error);

      // Assert
      expect(mapped.code).toBe('internal-error');
      expect(mapped.unexpected).toBe(error);
    });
  });
});
