import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AppConfig } from '../../../common/config/app-config.js';
import { APP_CONFIG } from '../../../common/config/config.module.js';
import type { Role } from '../../users/domain/user.js';
import type { ITokenIssuer, IssuedToken } from '../application/token-issuer.js';

/**
 * Adapter of `ITokenIssuer`: a JWT signed with HS256 (the algorithm is fixed, SEC-API-02) that lasts the time of
 * the configuration, 24 hours by default (D-44). The payload has the user id (`sub`) and the role, nothing
 * else: no e-mail and no display name.
 */
@Injectable()
export class JwtTokenIssuer implements ITokenIssuer {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async issue(subject: { readonly userId: string; readonly role: Role }): Promise<IssuedToken> {
    const expiresIn = this.config.jwtExpiresInSeconds;
    const accessToken = await this.jwt.signAsync(
      { sub: subject.userId, role: subject.role },
      { algorithm: 'HS256', expiresIn },
    );
    return { accessToken, expiresIn };
  }
}
