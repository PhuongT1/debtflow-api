import { Injectable } from '@nestjs/common';
import { badRequest } from '@common/errors/app-errors';
import { Prisma } from '@generated/prisma';

type CatalogProduct = Prisma.ProductGetPayload<{ include: { brand: true; category: true } }>;
import { PrismaService } from '@database/prisma.service';
import { CreateDebtItemDto } from '../dto/items/create-debt-item.dto';

@Injectable()
export class DebtLineItemService {
  constructor(private readonly prisma: PrismaService) {}

  async prepare(
    items: CreateDebtItemDto[] | undefined,
    originalAmount: Prisma.Decimal,
    organizationId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    if (!items?.length) return [];

    const productIds = items.flatMap((item) => (item.productId ? [item.productId] : []));
    const products = await db.product.findMany({
      where: { organizationId, id: { in: productIds }, isActive: true },
      include: { brand: true, category: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    const prepared = items.map((item) => this.toItem(item, productById));
    const total = prepared.reduce((sum, item) => sum.plus(item.lineAmount), new Prisma.Decimal(0));

    if (!total.equals(originalAmount)) {
      throw badRequest('items.TOTAL_MISMATCH');
    }

    return prepared;
  }

  private toItem(item: CreateDebtItemDto, productById: Map<string, CatalogProduct>) {
    const product = item.productId ? productById.get(item.productId) : undefined;

    if (item.productId && !product) {
      throw badRequest('items.PRODUCT_NOT_FOUND');
    }

    const quantity = new Prisma.Decimal(item.quantity);
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    const productName = product?.name ?? item.productName?.trim();

    if (!productName) throw badRequest('items.NAME_REQUIRED');
    if (!quantity.greaterThan(0) || !unitPrice.greaterThan(0)) {
      throw badRequest('items.QUANTITY_PRICE_INVALID');
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
