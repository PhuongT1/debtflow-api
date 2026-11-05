import { PrismaService } from '@database/prisma.service.js';
import { Injectable } from '@nestjs/common';
import { CatalogRepository } from '../repositories/catalog.repository.js';

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
      }),
      this.prisma.brand.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: 'asc' },
        include: { brand: true, category: true },
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
