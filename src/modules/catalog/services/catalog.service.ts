import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

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
