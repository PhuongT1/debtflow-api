import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { unauthorized } from '@common/errors/app-errors.js';
import { appConfig, type AppConfig } from '@config/app.config.js';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@database/prisma.service.js';
import type { JwtAuthPayload, AuthenticatedRequest } from '../types/auth-context.types.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer') throw unauthorized('auth.MISSING_TOKEN');
    if (!token) throw unauthorized('auth.MISSING_TOKEN');
    let payload: JwtAuthPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtAuthPayload>(token, {
        secret: this.config.auth.jwtSecret,
      });
      if (
        payload.type !== 'access' ||
        !payload.sub ||
        !payload.organizationId ||
        !payload.membershipId
      )
        throw new Error('Invalid tenant context');
    } catch {
      throw unauthorized('auth.TOKEN_EXPIRED');
    }
    // A signed token proves identity; current database state decides access and role.
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        id: payload.membershipId,
        organizationId: payload.organizationId,
        userId: payload.sub,
        status: 'ACTIVE',
        user: { status: 'ACTIVE' },
        organization: { status: 'ACTIVE' },
      },
      select: { role: true, user: { select: { email: true, systemRole: true } } },
    });
    if (!membership) throw unauthorized('auth.ACCOUNT_NOT_FOUND_OR_LOCKED');
    request.user = {
      ...payload,
      role: membership.role,
      email: membership.user.email,
      systemRole: membership.user.systemRole,
    };
    return true;
  }
}
