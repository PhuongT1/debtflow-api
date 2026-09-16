import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { OrganizationRole, SystemRole } from '@generated/prisma';
import { IS_PUBLIC_KEY } from './public.decorator';

export type JwtAuthPayload = { sub: string; email: string; systemRole: SystemRole; organizationId: string; membershipId: string; role: OrganizationRole; type: 'access' };
export type AuthenticatedRequest = Request & { user?: JwtAuthPayload };
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService, private readonly configService: ConfigService, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [, token] = request.headers.authorization?.split(' ') ?? [];
    if (!token) throw new UnauthorizedException('Thiếu Bearer token.');
    try {
      const payload = await this.jwtService.verifyAsync<JwtAuthPayload>(token, { secret: this.configService.get<string>('JWT_SECRET') });
      if (payload.type !== 'access' || !payload.organizationId || !payload.membershipId) throw new Error('Invalid tenant context');
      request.user = payload;
      return true;
    } catch { throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn.'); }
  }
}
