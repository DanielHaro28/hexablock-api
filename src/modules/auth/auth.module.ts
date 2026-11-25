import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { AppConfig } from '../../common/config/app-config.js';
import { APP_CONFIG } from '../../common/config/config.module.js';
import type { IUserRepository } from '../users/application/user-repository.js';
import { USER_REPOSITORY } from '../users/users.tokens.js';
import { UsersModule } from '../users/users.module.js';
import type { IPasswordHasher } from './application/password-hasher.js';
import { RegisterUserUseCase } from './application/register-user.use-case.js';
import type { ITokenIssuer } from './application/token-issuer.js';
import { PASSWORD_HASHER, REGISTER_USER, TOKEN_ISSUER } from './auth.tokens.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js';
import { JwtTokenIssuer } from './infrastructure/jwt-token-issuer.js';
import { AuthController } from './presentation/auth.controller.js';

/** Composition root of `auth` (layer 4): the ports are wired to their adapters, and the use cases to the ports. */
@Module({
  imports: [
    UsersModule,
    // The secret comes from the validated configuration (at least 32 bytes, SEC-API-02).
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({ secret: config.jwtSecret }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    Argon2PasswordHasher,
    JwtTokenIssuer,
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
    { provide: TOKEN_ISSUER, useExisting: JwtTokenIssuer },
    {
      provide: REGISTER_USER,
      inject: [USER_REPOSITORY, PASSWORD_HASHER, TOKEN_ISSUER],
      useFactory: (users: IUserRepository, hasher: IPasswordHasher, tokens: ITokenIssuer) =>
        new RegisterUserUseCase(users, hasher, tokens),
    },
  ],
})
export class AuthModule {}
