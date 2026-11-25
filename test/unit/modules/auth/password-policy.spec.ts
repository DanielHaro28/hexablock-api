import { describe, expect, it } from '@jest/globals';
import { PasswordPolicy } from '../../../../src/modules/auth/domain/password-policy.js';

/** A password of exactly `length` characters that is not on the common list. */
function passwordOf(length: number): string {
  return 'qZ7!'.repeat(Math.ceil(length / 4)).slice(0, length);
}

describe('SEC-API-02 · password policy (D-52)', () => {
  describe('length: 15 to 128 characters', () => {
    it('should_report_too_short_when_the_password_has_14_characters', () => {
      // Arrange
      const password = passwordOf(14);

      // Act
      const violation = PasswordPolicy.violation(password);

      // Assert
      expect(violation).toBe('too-short');
    });

    it('should_accept_the_password_when_it_has_15_characters', () => {
      // Act
      const violation = PasswordPolicy.violation(passwordOf(15));

      // Assert
      expect(violation).toBeUndefined();
    });

    it('should_accept_the_password_when_it_has_128_characters', () => {
      // Act
      const violation = PasswordPolicy.violation(passwordOf(128));

      // Assert
      expect(violation).toBeUndefined();
    });

    it('should_report_too_long_when_the_password_has_129_characters', () => {
      // Act
      const violation = PasswordPolicy.violation(passwordOf(129));

      // Assert
      expect(violation).toBe('too-long');
    });

    it('should_count_characters_and_not_bytes_when_the_password_has_accents_and_emoji', () => {
      // Arrange: 8 emoji are 8 characters (16 UTF-16 units, 32 bytes); 15 accented letters are 15
      const eightEmoji = '😀'.repeat(8);
      const fifteenAccented = 'ñ'.repeat(5) + 'é'.repeat(5) + 'ü'.repeat(5);

      // Act
      const emojiViolation = PasswordPolicy.violation(eightEmoji);
      const accentedViolation = PasswordPolicy.violation(fifteenAccented);

      // Assert
      expect(emojiViolation).toBe('too-short');
      expect(accentedViolation).toBeUndefined();
    });

    it('should_accept_spaces_and_not_require_composition_when_the_password_is_long_enough', () => {
      // Arrange: only lower case letters and spaces, no digit and no symbol (D-52: no composition rules)
      const password = 'correct horse battery';

      // Act
      const violation = PasswordPolicy.violation(password);

      // Assert
      expect(violation).toBeUndefined();
    });
  });

  describe('common passwords', () => {
    it('should_report_too_common_when_the_password_is_on_the_list', () => {
      // Arrange: on the NCSC list, 20 characters
      const password = '1q2w3e4r5t6y7u8i9o0p';

      // Act
      const violation = PasswordPolicy.violation(password);

      // Assert
      expect(violation).toBe('too-common');
    });

    it('should_report_too_common_when_only_the_case_differs_from_a_listed_password', () => {
      // Arrange
      const password = '1Q2W3E4R5T6Y7U8I9O0P';

      // Act
      const violation = PasswordPolicy.violation(password);

      // Assert
      expect(violation).toBe('too-common');
    });
  });
});
