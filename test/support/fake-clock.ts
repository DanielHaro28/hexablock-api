import type { IClock } from '../../src/common/application/clock.js';

/** A clock that only moves when a test says so (D-56): no real waiting in the tests. */
export class FakeClock implements IClock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  advanceSeconds(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
}
