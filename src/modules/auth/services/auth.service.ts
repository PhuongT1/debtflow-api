import { Injectable } from '@nestjs/common';
import { forbidden, unauthorized } from '@common/errors/app-errors';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@database/prisma.service';
import { OrganizationMembershipStatus, UserStatus } from '@generated/prisma';
import { LoginDto } from '@modules/auth/dto/login.dto';

import type {
  JwtAuthPayload as AccessTokenPayload,
  RefreshTokenPayload,
} from '@auth/types/auth-context.types';
import type { AuthUser, MembershipContext } from '../types/auth.types';
import { AUTH_USER_SELECT, MEMBERSHIP_CONTEXT_SELECT } from '../queries/auth.select';

const DEFAULT_ACCESS_TOKEN_EXPIRES_IN = '15m';
const DEFAULT_REFRESH_TOKEN_EXPIRES_IN = '7d';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(input: LoginDto) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...AUTH_USER_SELECT, passwordHash: true },
    });
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
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw unauthorized('auth.REFRESH_TOKEN_INVALID');
    }
    if (payload.type !== 'refresh') throw unauthorized('auth.REFRESH_TOKEN_INVALID');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: AUTH_USER_SELECT,
    });
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
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: AUTH_USER_SELECT,
    });
    if (user.status !== UserStatus.ACTIVE) throw forbidden('auth.ACCOUNT_LOCKED');
    return this.createTokenResponse(
      this.toSafeUser(user),
      await this.getMembership(user.id, organizationId),
    );
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: AUTH_USER_SELECT,
    });
    const organizations = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
        status: OrganizationMembershipStatus.ACTIVE,
        organization: { status: 'ACTIVE' },
      },
      select: MEMBERSHIP_CONTEXT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
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
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
        status: OrganizationMembershipStatus.ACTIVE,
        organization: { status: 'ACTIVE' },
        ...(organizationId ? { organizationId } : {}),
        ...(membershipId ? { id: membershipId } : {}),
      },
      select: MEMBERSHIP_CONTEXT_SELECT,
      orderBy: { createdAt: 'asc' },
      take: 1,
    });
    const membership = memberships[0];
    if (!membership) throw forbidden('auth.NO_ACTIVE_ORGANIZATION');
    return membership;
  }

  private async createTokenResponse(user: AuthUser, membership: MembershipContext) {
    const accessTokenExpiresIn = (this.configService.get<string>('JWT_EXPIRES_IN') ??
      DEFAULT_ACCESS_TOKEN_EXPIRES_IN) as JwtSignOptions['expiresIn'];
    const refreshTokenExpiresIn = (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ??
      DEFAULT_REFRESH_TOKEN_EXPIRES_IN) as JwtSignOptions['expiresIn'];
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
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: accessTokenExpiresIn,
      } satisfies JwtSignOptions,
    );
    const refreshToken = await this.jwtService.signAsync(
      { ...shared, type: 'refresh' } satisfies RefreshTokenPayload,
      {
        secret: this.configService.get<string>('JWT_SECRET'),
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
