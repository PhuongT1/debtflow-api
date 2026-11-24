import { Inject, Injectable } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { appConfig, type AppConfig } from '@config/app.config.js';
import { ApplicationError } from '@common/errors/application-error.js';
import type { AuthCredentials } from '../application/auth-credentials.port.js';
import type { AuthUser, MembershipContext } from '../application/auth.types.js';

type SessionTokenClaims = {
  sub: string;
  organizationId: string;
  membershipId: string;
  role: string;
} & ({ type: 'access'; email: string; systemRole: string } | { type: 'refresh' });

@Injectable()
export class JwtAuthCredentialsAdapter implements AuthCredentials {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }

  async readRefresh(token: string) {
    let payload: Extract<SessionTokenClaims, { type: 'refresh' }>;
    try {
      payload = await this.jwtService.verifyAsync<typeof payload>(token, {
        secret: this.config.auth.jwtSecret,
      });
    } catch {
      throw new ApplicationError('unauthorized', 'auth.REFRESH_TOKEN_INVALID');
    }
    if (payload.type !== 'refresh') {
      throw new ApplicationError('unauthorized', 'auth.REFRESH_TOKEN_INVALID');
    }
    return payload;
  }

  async issue(user: AuthUser, membership: MembershipContext) {
    const { accessTokenExpiresIn, refreshTokenExpiresIn } = this.config.auth;
    const accessTokenExpiresAt = this.getExpiresAt(accessTokenExpiresIn);
    const shared = {
      sub: user.id,
      organizationId: membership.organizationId,
      membershipId: membership.id,
      role: membership.role,
    };
    const accessToken = await this.jwtService.signAsync(
      {
        ...shared,
        email: user.email,
        systemRole: user.systemRole,
        type: 'access',
      } satisfies SessionTokenClaims,
      {
        secret: this.config.auth.jwtSecret,
        expiresIn: accessTokenExpiresIn,
      } satisfies JwtSignOptions,
    );
    const refreshToken = await this.jwtService.signAsync(
      { ...shared, type: 'refresh' } satisfies SessionTokenClaims,
      {
        secret: this.config.auth.jwtSecret,
        expiresIn: refreshTokenExpiresIn,
      } satisfies JwtSignOptions,
    );
    return {
      accessToken,
      accessTokenExpiresAt,
      expiresIn: Math.max(0, Math.floor((accessTokenExpiresAt - Date.now()) / 1000)),
      refreshToken,
      tokenType: 'Bearer',
    };
  }

  private getExpiresAt(expiresIn: JwtSignOptions['expiresIn']) {
    if (typeof expiresIn === 'number') return Date.now() + expiresIn * 1000;
    const match = String(expiresIn)
      .trim()
      .match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) return Date.now() + 15 * 60 * 1000;
    const multiplier =
      match[2] === 'ms'
        ? 1
        : match[2] === 's'
          ? 1000
          : match[2] === 'm'
            ? 60_000
            : match[2] === 'h'
              ? 3_600_000
              : 86_400_000;
    return Date.now() + Number(match[1]) * multiplier;
  }
}
