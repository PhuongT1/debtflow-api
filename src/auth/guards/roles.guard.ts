import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrganizationRole } from '@generated/prisma';
import type { AuthenticatedRequest } from '@auth/types/auth-context.types';
import { ROLES_KEY } from '../decorators/roles.decorator';
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const allowedRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowedRoles?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return Boolean(request.user && allowedRoles.includes(request.user.role));
  }
}
