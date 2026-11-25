import { describe, expect, it } from '@jest/globals';
import { LevelCursor } from '../../../../src/modules/levels/domain/level-cursor.js';

describe('RN-COM-77 · cursor of the level download (D-48)', () => {
  it('should_encode_the_sequence_as_base64url_when_it_is_a_number', () => {
    // Act
    const cursor = LevelCursor.encode(12n);

    // Assert
    expect(cursor).toBe(Buffer.from('12').toString('base64url'));
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([0n, 1n, 99n, 123_456_789_012n, 9_223_372_036_854_775_807n])(
    'should_decode_to_the_same_sequence_when_it_was_encoded (%s)',
    (sequence) => {
      // Act
      const decoded = LevelCursor.decode(LevelCursor.encode(sequence));

      // Assert
      expect(decoded).toBe(sequence);
    },
  );

  it.each([
    ['not digits', Buffer.from('abc').toString('base64url')],
    ['a negative number', Buffer.from('-5').toString('base64url')],
    ['a decimal', Buffer.from('1.5').toString('base64url')],
    ['an empty value', ''],
    ['characters outside base64url', 'not valid!'],
    [
      'a number above the range of a bigint column',
      Buffer.from('9223372036854775808').toString('base64url'),
    ],
    ['digits with a sign and spaces', Buffer.from(' 12 ').toString('base64url')],
    ['another spelling of the same bytes', 'MTJ'],
  ])('should_not_decode_when_the_cursor_is_%s', (_label, cursor) => {
    // Act
    const decoded = LevelCursor.decode(cursor);

    // Assert
    expect(decoded).toBeUndefined();
  });

  it('should_start_from_zero_when_there_is_no_cursor', () => {
    // Act + Assert
    expect(LevelCursor.START).toBe(0n);
  });
});
