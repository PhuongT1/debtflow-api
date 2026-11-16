import { ApplicationError } from '@common/errors/application-error.js';

/** Fail closed before Prisma can treat an absent tenant condition as an unscoped query. */
export function requireOrganizationId(organizationId: string): void {
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new ApplicationError('forbidden', 'errors.FORBIDDEN');
  }
}
