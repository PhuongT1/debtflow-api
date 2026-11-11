import type { Brand, Category, Party, Prisma } from '@generated/prisma/client.js';
export type CatalogOptions = {
  brands: Brand[];
  categories: Category[];
  products: Prisma.ProductGetPayload<{ include: { brand: true; category: true } }>[];
  provinces: Pick<Party, 'provinceCode' | 'provinceName'>[];
};
