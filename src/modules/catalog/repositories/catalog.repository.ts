import type { CatalogOptions } from '../catalog.types.js';
export abstract class CatalogRepository {
  abstract options(organizationId: string): Promise<CatalogOptions>;
}
