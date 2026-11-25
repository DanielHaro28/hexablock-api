import type { IClock } from '../application/clock.js';

/** The real clock of the machine, the adapter of `IClock`. */
export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}
