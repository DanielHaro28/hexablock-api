import { ValidationPipe } from '@nestjs/common';
import type { ValidationError as ClassValidatorError } from 'class-validator';
import { type FieldError, ValidationError } from '../domain/domain-error.js';
import { MAX_FIELD_ERRORS } from './problem-details.js';

/**
 * Codes for the constraints of class-validator that clients are expected to understand. `minLength` and
 * `maxLength` are `too-short` and `too-long`, the codes of the password and the display name (D-52, D-50).
 */
const CONSTRAINT_CODES: Readonly<Record<string, string>> = {
  minLength: 'too-short',
  maxLength: 'too-long',
  isNotEmpty: 'required',
  isDefined: 'required',
  whitelistValidation: 'not-allowed',
  isEmail: 'invalid-email',
  matches: 'invalid-format',
  isIn: 'invalid-value',
  isEnum: 'invalid-value',
  min: 'too-small',
  max: 'too-large',
};

/** `isString` -> `is-string`: the generic code for a constraint that has no entry above. */
function kebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** RFC 6901: `~` is `~0` and `/` is `~1`. */
function escapePointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

/**
 * Converts the errors of class-validator to `{ pointer, code }`. The submitted value is never copied: only
 * the field and the rule that failed (D-51, SEC-API-03).
 */
export function toFieldErrors(errors: readonly ClassValidatorError[], parent = ''): FieldError[] {
  const result: FieldError[] = [];
  for (const error of errors) {
    const pointer = `${parent}/${escapePointerSegment(error.property)}`;
    for (const constraint of Object.keys(error.constraints ?? {})) {
      result.push({ pointer, code: CONSTRAINT_CODES[constraint] ?? kebabCase(constraint) });
    }
    result.push(...toFieldErrors(error.children ?? [], pointer));
  }
  return result.slice(0, MAX_FIELD_ERRORS);
}

/**
 * The global `ValidationPipe` (SEC-API-03): unknown properties are rejected, so `role` can never be assigned
 * from the client, and every failure becomes a `ValidationError` for the global filter.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    // The error objects do not keep the target or the submitted value.
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => new ValidationError(toFieldErrors(errors)),
  });
}
