import { Injectable } from '@nestjs/common';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { UsersRepository } from '../repositories/users.repository.js';

/** The users module owns active membership semantics for all in-process consumers. */
@Injectable()
export class OrganizationMembersService {
  constructor(private readonly repository: UsersRepository) {}
  isActive(organizationId: string, userId: string) {
    requireOrganizationId(organizationId);
    return this.repository.isActive(organizationId, userId);
  }
}
