import { Controller, Get, Inject } from '@nestjs/common';
import type { UseCase } from '../../../common/application/use-case.js';
import type { AuthenticatedUser } from '../../auth/application/token-verifier.js';
import { CurrentUser } from '../../auth/presentation/current-user.decorator.js';
import type { AllProgress, GetProgressInput } from '../application/get-progress.use-case.js';
import { GET_PROGRESS } from '../progress.tokens.js';

/**
 * Thin controller of `/v1/me/progress`. The path says `me` on purpose: the user is the one of the token and no
 * route, query or body names another (SEC-API-01). Every route here needs a valid token (the guard denies by
 * default).
 */
@Controller('v1/me/progress')
export class ProgressController {
  constructor(
    @Inject(GET_PROGRESS) private readonly getProgress: UseCase<GetProgressInput, AllProgress>,
  ) {}

  /** The progress of every variant and topology of the caller (RN-COM-90). */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<AllProgress> {
    return this.getProgress.execute({ userId: user.userId });
  }
}
