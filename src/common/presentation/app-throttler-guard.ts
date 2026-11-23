import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { TooManyRequestsError } from '../domain/domain-error.js';

/**
 * Rate limiting by IP (SEC-API-04). It only changes how the limit is reported: a `TooManyRequestsError` that the
 * global filter answers as Problem Details with `Retry-After` in seconds (RFC 6585). The library would put it in
 * `Retry-After-<name>` for named throttlers, which is not what the contract says.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    return Promise.reject(new TooManyRequestsError(Math.max(1, detail.timeToBlockExpire)));
  }
}
