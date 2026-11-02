import { forbidden } from '@common/errors/app-errors';

/** Fail closed before Prisma can treat an absent tenant condition as an unscoped query. */
export function requireOrganizationId(organizationId: string): void {
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw forbidden('errors.FORBIDDEN');
  }
}
