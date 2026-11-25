import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import {
  ConflictError,
  ForbiddenError,
  ImplausibleResultError,
  InvalidCredentialsError,
  InvalidLevelError,
  NotFoundError,
  UnauthorizedError,
} from '../../src/common/domain/domain-error.js';
import { Public } from '../../src/common/presentation/public.js';
import type { AuthenticatedUser } from '../../src/modules/auth/application/token-verifier.js';
import { CurrentUser } from '../../src/modules/auth/presentation/current-user.decorator.js';
import { Roles } from '../../src/modules/auth/presentation/roles.decorator.js';

export class EchoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  count?: number;
}

/**
 * Routes that exist only in the tests, to exercise the global pipeline (filter, pipe, headers) before the
 * real controllers arrive. They are not part of the application. They are public: the guard denies by default.
 */
@Public()
@Controller('__probe')
export class ProbeController {
  @Post('echo')
  @HttpCode(200)
  echo(@Body() dto: EchoDto): { name: string } {
    return { name: dto.name };
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret detail: relation "users" does not exist, password=hunter2');
  }

  @Get('unauthorized')
  unauthorized(): never {
    throw new UnauthorizedError();
  }

  @Get('invalid-token')
  invalidToken(): never {
    throw new UnauthorizedError(true);
  }

  @Get('invalid-credentials')
  invalidCredentials(): never {
    throw new InvalidCredentialsError();
  }

  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenError();
  }

  @Get('not-found')
  notFound(): never {
    throw new NotFoundError();
  }

  @Get('conflict')
  conflict(): never {
    throw new ConflictError('email-taken');
  }

  @Get('invalid-level')
  invalidLevel(): never {
    throw new InvalidLevelError([{ pointer: '/variant/solution', code: 'rn-hf-12-d' }]);
  }

  @Get('implausible')
  implausible(): never {
    throw new ImplausibleResultError();
  }
}

/**
 * A route that is not marked `@Public()`, like every route of the application except register, login and
 * health: it answers who the guard says is calling, and nothing else (SEC-API-01).
 */
@Controller('__private')
export class PrivateProbeController {
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Roles('ADMIN')
  @Get('admin')
  admin(): { ok: true } {
    return { ok: true };
  }
}
