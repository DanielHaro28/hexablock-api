import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import type { UseCase } from '../../../common/application/use-case.js';
import { Public } from '../../../common/presentation/public.js';
import type { AuthResult } from '../application/auth-result.js';
import type { Credentials } from '../application/login.use-case.js';
import type { RegisterInput } from '../application/register-user.use-case.js';
import { LOGIN_USER, REGISTER_USER } from '../auth.tokens.js';
import { LoginDto } from './login.dto.js';
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

/**
 * Thin controller: validates the DTO, calls the use case and answers what the contract says (ARQ-03-API §2).
 * Register and login are the only routes of the application that are open to callers without a token.
 */
@Public()
@Controller('v1/auth')
export class AuthController {
  constructor(
    @Inject(REGISTER_USER) private readonly registerUser: UseCase<RegisterInput, AuthResult>,
    @Inject(LOGIN_USER) private readonly loginUser: UseCase<Credentials, AuthResult>,
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

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return toAuthResponse(
      await this.loginUser.execute({ email: dto.email, password: dto.password }),
    );
  }
}
