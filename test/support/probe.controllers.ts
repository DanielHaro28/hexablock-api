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
 * real controllers arrive. They are not part of the application.
 */
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

/** Stands in for login and register to test the stricter limit of `/v1/auth/*`. */
@Controller('v1/auth')
export class FakeAuthController {
  @Post('login')
  @HttpCode(200)
  login(): { ok: true } {
    return { ok: true };
  }
}
