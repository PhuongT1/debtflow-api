import { Injectable } from '@nestjs/common';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { CatalogRepository } from './repositories/catalog.repository.js';
@Injectable()
export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}
  options(organizationId: string) {
    requireOrganizationId(organizationId);
    return this.repository.options(organizationId);
  }
}
