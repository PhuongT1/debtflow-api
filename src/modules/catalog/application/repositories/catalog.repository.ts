import type { CatalogOptions } from '../catalog-options.types.js';
export abstract class CatalogRepository {
  abstract options(organizationId: string): Promise<CatalogOptions>;
}
