/** The largest value of a PostgreSQL `bigint`, the type of `levels.change_seq`. */
const MAX_SEQUENCE = 9_223_372_036_854_775_807n;

/**
 * The cursor of the level download (D-48, RN-COM-77): the last `change_seq` that was delivered, written in
 * base64url. It is opaque for the app, which only stores it and sends it back. It comes from a sequence of the
 * server, so it does not depend on the clock of the phone.
 */
export const LevelCursor = {
  /** Where a download without a cursor starts: before the first change. */
  START: 0n,

  encode(sequence: bigint): string {
    return Buffer.from(sequence.toString(), 'utf8').toString('base64url');
  },

  /** The sequence of a cursor, or `undefined` when it is not one this API could have issued. */
  decode(cursor: string): bigint | undefined {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) return undefined;
    const text = Buffer.from(cursor, 'base64url').toString('utf8');
    if (!/^(0|[1-9][0-9]*)$/.test(text)) return undefined;
    const sequence = BigInt(text);
    // Only the exact text this API writes: base64url has several spellings of the same bytes.
    return sequence <= MAX_SEQUENCE && LevelCursor.encode(sequence) === cursor
      ? sequence
      : undefined;
  },
} as const;
