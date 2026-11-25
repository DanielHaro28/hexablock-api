import { COMMON_PASSWORDS } from './common-passwords.js';

/** The rules that a password can break; they are the `code` of the error in `/password` (D-52). */
export type PasswordViolation = 'too-short' | 'too-long' | 'too-common';

/**
 * The password rules of D-52 (NIST SP 800-63B rev. 4 for a password that is the only factor): 15 to 128
 * characters, no composition rules, spaces and Unicode allowed, never truncated, and not on a public list of
 * common passwords. Plain TypeScript, so every entry point applies the same rules (SEC-API-02).
 */
export const PasswordPolicy = {
  MIN_LENGTH: 15,
  MAX_LENGTH: 128,

  /** The first rule that `password` breaks, or `undefined` when it is acceptable. */
  violation(password: string): PasswordViolation | undefined {
    // `[...password]` counts characters (code points), like the `minLength` of the contract, not UTF-16 units.
    const length = [...password].length;
    if (length < PasswordPolicy.MIN_LENGTH) return 'too-short';
    if (length > PasswordPolicy.MAX_LENGTH) return 'too-long';
    if (COMMON_PASSWORDS.has(password.normalize('NFKC').toLowerCase())) return 'too-common';
    return undefined;
  },
} as const;
