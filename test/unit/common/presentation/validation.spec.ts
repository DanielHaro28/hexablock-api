import { describe, expect, it } from '@jest/globals';
import {
  IsEmail,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  validate,
  ValidateNested,
} from 'class-validator';
import { MAX_FIELD_ERRORS } from '../../../../src/common/presentation/problem-details.js';
import { toFieldErrors } from '../../../../src/common/presentation/validation.js';

class Address {
  @IsString()
  @MinLength(3)
  street!: string;
}

class Sample {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(15)
  @MaxLength(128)
  password!: string;

  @IsInt()
  @Min(0)
  score!: number;

  @Matches(/^[a-z]+$/)
  slug!: string;

  @ValidateNested()
  address!: Address;
}

function sample(values: Partial<Record<keyof Sample, unknown>>): Sample {
  return Object.assign(new Sample(), {
    email: 'ana@example.com',
    password: 'a-long-enough-password',
    score: 1,
    slug: 'abc',
    address: Object.assign(new Address(), { street: 'Main' }),
    ...values,
  });
}

describe('SEC-API-03 · validation errors say where and which rule, never the value (D-51)', () => {
  it('should_return_no_errors_when_the_object_is_valid', async () => {
    // Arrange
    const errors = await validate(sample({}));

    // Act
    const fieldErrors = toFieldErrors(errors);

    // Assert
    expect(fieldErrors).toEqual([]);
  });

  it('should_use_too_short_and_too_long_when_a_text_is_out_of_range', async () => {
    // Arrange
    const tooShort = await validate(sample({ password: 'short' }));
    const tooLong = await validate(sample({ password: 'x'.repeat(129) }));

    // Act
    const shortCodes = toFieldErrors(tooShort);
    const longCodes = toFieldErrors(tooLong);

    // Assert
    expect(shortCodes).toEqual([{ pointer: '/password', code: 'too-short' }]);
    expect(longCodes).toEqual([{ pointer: '/password', code: 'too-long' }]);
  });

  it('should_name_the_field_with_a_json_pointer_when_a_nested_field_fails', async () => {
    // Arrange
    const address = Object.assign(new Address(), { street: 'ab' });
    const errors = await validate(sample({ address }));

    // Act
    const fieldErrors = toFieldErrors(errors);

    // Assert
    expect(fieldErrors).toEqual([{ pointer: '/address/street', code: 'too-short' }]);
  });

  it.each([
    ['email', { email: 'not-an-email' }, 'invalid-email'],
    ['slug', { slug: 'NOPE' }, 'invalid-format'],
    ['score', { score: -1 }, 'too-small'],
    ['score', { score: 1.5 }, 'is-int'],
  ])('should_map_the_failure_of_%s_to_%s_when_the_value_is_wrong', async (field, values, code) => {
    // Arrange
    const errors = await validate(sample(values));

    // Act
    const fieldErrors = toFieldErrors(errors);

    // Assert
    expect(fieldErrors).toEqual([{ pointer: `/${field}`, code }]);
  });

  it('should_escape_slash_and_tilde_in_the_pointer_when_a_property_name_has_them', () => {
    // Arrange
    const errors = [{ property: 'a/b~c', constraints: { isString: 'x' } }];

    // Act
    const fieldErrors = toFieldErrors(errors);

    // Assert
    expect(fieldErrors).toEqual([{ pointer: '/a~1b~0c', code: 'is-string' }]);
  });

  it('should_not_contain_the_submitted_value_when_a_field_fails', async () => {
    // Arrange
    const secret = 'hunter2-is-my-password';
    const errors = await validate(sample({ email: secret }));

    // Act
    const fieldErrors = toFieldErrors(errors);

    // Assert
    expect(JSON.stringify(fieldErrors)).not.toContain(secret);
  });

  it('should_cap_the_list_at_the_contract_limit_when_there_are_too_many_failures', () => {
    // Arrange
    const errors = Array.from({ length: MAX_FIELD_ERRORS + 5 }, (_, index) => ({
      property: `f${index}`,
      constraints: { isString: 'x' },
    }));

    // Act
    const fieldErrors = toFieldErrors(errors);

    // Assert
    expect(fieldErrors).toHaveLength(MAX_FIELD_ERRORS);
  });
});
