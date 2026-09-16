import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma';

type CatalogProduct = Prisma.ProductGetPayload<{ include: { brand: true; category: true } }>;
type PreparedDebtItem = {
  product?: { connect: { id: string } };
  productCode?: string;
  productName: string;
  categoryName?: string;
  brandName?: string;
  quantity: Prisma.Decimal;
  unit: string;
  unitPrice: Prisma.Decimal;
  lineAmount: Prisma.Decimal;
};
import { PrismaService } from '@database/prisma.service';
import { CreateDebtItemDto } from './dto/create-debt-item.dto';

@Injectable()
export class DebtLineItemService {
  constructor(private readonly prisma: PrismaService) {}

  async prepare(items: CreateDebtItemDto[] | undefined, originalAmount: Prisma.Decimal, organizationId: string) {
    if (!items?.length) return [];

    const productIds = items.flatMap((item) => (item.productId ? [item.productId] : []));
    const products = await this.prisma.product.findMany({
      where: { organizationId, id: { in: productIds } },
      include: { brand: true, category: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    const prepared = items.map((item) => this.toItem(item, productById));
    const total = prepared.reduce((sum, item) => sum.plus(item.lineAmount), new Prisma.Decimal(0));

    if (!total.equals(originalAmount)) {
      throw new BadRequestException('Tổng tiền dòng hàng phải bằng tổng công nợ');
    }

    return prepared;
  }

  private toItem(
    item: CreateDebtItemDto,
    productById: Map<string, CatalogProduct>,
  ): PreparedDebtItem {
    const product = item.productId ? productById.get(item.productId) : undefined;

    if (item.productId && !product) {
      throw new BadRequestException('Mặt hàng không tồn tại hoặc đã ngừng hoạt động');
    }

    const quantity = new Prisma.Decimal(item.quantity);
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    const productName = product?.name ?? item.productName?.trim();

    if (!productName) throw new BadRequestException('Tên mặt hàng là bắt buộc');
    if (!quantity.greaterThan(0) || !unitPrice.greaterThan(0)) {
      throw new BadRequestException('Số lượng và đơn giá phải lớn hơn 0');
    }

    return {
      ...(product ? { product: { connect: { id: product.id } } } : {}),
      productCode: product?.code,
      productName,
      categoryName: product?.category.name,
      brandName: product?.brand?.name,
      quantity,
      unit: (product?.unit ?? item.unit?.trim()) || 'Cái',
      unitPrice,
      lineAmount: quantity.mul(unitPrice),
    };
  }
}
