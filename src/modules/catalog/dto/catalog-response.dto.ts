export class CatalogEntryDto {
  id!: string;
  organizationId!: string;
  code!: string;
  name!: string;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
export class BrandResponseDto extends CatalogEntryDto {}
export class CategoryResponseDto extends CatalogEntryDto {
  sortOrder!: number;
}
export class ProductResponseDto extends CatalogEntryDto {
  categoryId!: string;
  brandId!: string | null;
  unit!: string;
  brand!: BrandResponseDto | null;
  category!: CategoryResponseDto;
}
export class ProvinceOptionDto {
  provinceCode!: string;
  provinceName!: string | null;
}
export class CatalogOptionsResponseDto {
  brands!: BrandResponseDto[];
  categories!: CategoryResponseDto[];
  products!: ProductResponseDto[];
  provinces!: ProvinceOptionDto[];
}
