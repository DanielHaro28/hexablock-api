import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import type { UseCase } from '../../../common/application/use-case.js';
import type { AuthResult } from '../application/auth-result.js';
import type { RegisterInput } from '../application/register-user.use-case.js';
import { REGISTER_USER } from '../auth.tokens.js';
import { RegisterDto } from './register.dto.js';

/** `AuthResponse` of the contract. */
export interface AuthResponse {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly displayName: string;
}

function toAuthResponse(result: AuthResult): AuthResponse {
  return {
    accessToken: result.accessToken,
    tokenType: 'Bearer',
    expiresIn: result.expiresIn,
    displayName: result.displayName,
  };
}

/** Thin controller: validates the DTO, calls the use case and answers what the contract says (ARQ-03-API §2). */
@Controller('v1/auth')
export class AuthController {
  constructor(
    @Inject(REGISTER_USER) private readonly registerUser: UseCase<RegisterInput, AuthResult>,
  ) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return toAuthResponse(
      await this.registerUser.execute({
        email: dto.email,
        password: dto.password,
        displayName: dto.displayName,
      }),
    );
  }
}
