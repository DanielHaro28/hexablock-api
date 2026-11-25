/** Port of the current time (ARQ-03-API §4), so the rules that depend on "now" can be tested without waiting. */
export interface IClock {
  now(): Date;
}

/** Injection token of the `IClock` of the application. */
export const CLOCK = Symbol('CLOCK');
