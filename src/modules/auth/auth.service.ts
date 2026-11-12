import { Inject, Injectable } from '@nestjs/common';
import { forbidden, unauthorized } from '@common/errors/app-errors.js';
import { appConfig, type AppConfig } from '@config/app.config.js';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthRepository } from './repositories/auth.repository.js';
import { UserStatus } from '@generated/prisma/client.js';
import { LoginDto } from '@modules/auth/dto/login.dto.js';

import type {
  JwtAuthPayload as AccessTokenPayload,
  RefreshTokenPayload,
} from '@auth/types/auth-context.types.js';
import type { AuthUser, MembershipContext } from './auth.types.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  async login(input: LoginDto) {
    const email = input.email.trim().toLowerCase();
    const user = await this.repository.findForLogin(email);
    if (!user?.passwordHash || user.status !== UserStatus.ACTIVE) {
      throw unauthorized('auth.INVALID_CREDENTIALS');
    }
    if (!(await bcrypt.compare(input.password, user.passwordHash))) {
      throw unauthorized('auth.INVALID_CREDENTIALS');
    }
    const membership = await this.getMembership(user.id, input.organizationId);
    return this.createTokenResponse(this.toSafeUser(user), membership);
  }

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.auth.jwtSecret,
      });
    } catch {
      throw unauthorized('auth.REFRESH_TOKEN_INVALID');
    }
    if (payload.type !== 'refresh') throw unauthorized('auth.REFRESH_TOKEN_INVALID');
    const user = await this.repository.findUser(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE)
      throw unauthorized('auth.ACCOUNT_NOT_FOUND_OR_LOCKED');
    const membership = await this.getMembership(
      user.id,
      payload.organizationId,
      payload.membershipId,
    );
    return this.createTokenResponse(this.toSafeUser(user), membership);
  }

  async switchOrganization(userId: string, organizationId: string) {
    const user = await this.repository.getUser(userId);
    if (user.status !== UserStatus.ACTIVE) throw forbidden('auth.ACCOUNT_LOCKED');
    return this.createTokenResponse(
      this.toSafeUser(user),
      await this.getMembership(user.id, organizationId),
    );
  }

  async getCurrentUser(userId: string) {
    const user = await this.repository.getUser(userId);
    const organizations = await this.repository.memberships(userId);
    return {
      ...this.toSafeUser(user),
      organizations: organizations.map(({ id, role, organization }) => ({
        membershipId: id,
        role,
        ...organization,
      })),
    };
  }

  private async getMembership(
    userId: string,
    organizationId?: string,
    membershipId?: string,
  ): Promise<MembershipContext> {
    const membership = await this.repository.activeMembership(userId, organizationId, membershipId);
    if (!membership) throw forbidden('auth.NO_ACTIVE_ORGANIZATION');
    return membership;
  }

  private async createTokenResponse(user: AuthUser, membership: MembershipContext) {
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
      } satisfies AccessTokenPayload,
      {
        secret: this.config.auth.jwtSecret,
        expiresIn: accessTokenExpiresIn,
      } satisfies JwtSignOptions,
    );
    const refreshToken = await this.jwtService.signAsync(
      { ...shared, type: 'refresh' } satisfies RefreshTokenPayload,
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
      user,
      activeOrganization: {
        membershipId: membership.id,
        role: membership.role,
        ...membership.organization,
      },
    };
  }

  private toSafeUser(user: AuthUser): AuthUser {
    const { id, name, email, systemRole, status } = user;

    return { id, name, email, systemRole, status };
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
