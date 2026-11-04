import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import type { OrganizationRole } from '@generated/prisma/client.js';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: OrganizationRole[]) =>
  applyDecorators(SetMetadata(ROLES_KEY, roles), ApiExtension('x-roles', roles));
