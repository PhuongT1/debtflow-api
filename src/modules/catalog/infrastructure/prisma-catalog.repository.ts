import { PrismaService } from '@database/prisma.service.js';
import { Injectable } from '@nestjs/common';
import { CatalogRepository } from '../application/repositories/catalog.repository.js';

const catalogEntrySelect = {
  id: true,
  organizationId: true,
  code: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;
const categorySelect = { ...catalogEntrySelect, sortOrder: true } as const;

@Injectable()
export class PrismaCatalogRepository extends CatalogRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async options(organizationId: string) {
    const [categories, brands, products, provinces] = await Promise.all([
      this.prisma.category.findMany({
        where: { organizationId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: categorySelect,
      }),
      this.prisma.brand.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: 'asc' },
        select: catalogEntrySelect,
      }),
      this.prisma.product.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: 'asc' },
        select: {
          ...catalogEntrySelect,
          categoryId: true,
          brandId: true,
          unit: true,
          brand: { select: catalogEntrySelect },
          category: { select: categorySelect },
        },
      }),
      this.prisma.party.findMany({
        where: { organizationId, isActive: true, provinceCode: { not: null } },
        select: { provinceCode: true, provinceName: true },
        distinct: ['provinceCode'],
        orderBy: { provinceName: 'asc' },
      }),
    ]);

    return { brands, categories, products, provinces };
  }
}
