type CatalogEntry = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type CatalogCategory = CatalogEntry & { sortOrder: number };
type CatalogProduct = CatalogEntry & {
  categoryId: string;
  brandId: string | null;
  unit: string;
  brand: CatalogEntry | null;
  category: CatalogCategory;
};

export type CatalogOptions = {
  brands: CatalogEntry[];
  categories: CatalogCategory[];
  products: CatalogProduct[];
  provinces: { provinceCode: string | null; provinceName: string | null }[];
};
