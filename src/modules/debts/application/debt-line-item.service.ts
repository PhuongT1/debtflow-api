import { ApplicationError } from '@common/errors/application-error.js';
import type { DebtMoneyMath, DecimalAmount } from '@common/utils/decimal-amount.types.js';
import { MONEY_AMOUNT_PATTERN } from '@common/validation/money.constants.js';
import type { DebtLineItemInput } from './debt-inputs.types.js';
import type { CatalogProduct, PreparedDebtItem } from './debt-persistence.types.js';

/** Matches the storage precision of NUMERIC(14, 3). */
const QUANTITY_PATTERN = /^\d{1,11}(\.\d{1,3})?$/;

export class DebtLineItemService {
  constructor(private readonly money: DebtMoneyMath) {}

  async prepare(
    items: DebtLineItemInput[] | undefined,
    originalAmount: DecimalAmount,
    products: CatalogProduct[],
  ) {
    if (!items?.length) return [];

    const productById = new Map(products.map((product) => [product.id, product]));
    const prepared = items.map((item) => this.toItem(item, productById));
    const total = this.money.sum(prepared.map(({ lineAmount }) => lineAmount));

    if (!total.equals(originalAmount.toString())) {
      throw new ApplicationError('invalid', 'items.TOTAL_MISMATCH');
    }

    return prepared;
  }

  private toItem(
    item: DebtLineItemInput,
    productById: Map<string, CatalogProduct>,
  ): PreparedDebtItem {
    const product = item.productId ? productById.get(item.productId) : undefined;

    if (item.productId && !product) {
      throw new ApplicationError('invalid', 'items.PRODUCT_NOT_FOUND');
    }

    const quantity = this.money.parseQuantity(item.quantity, QUANTITY_PATTERN);
    const unitPrice = this.money.parseMoney(item.unitPrice);
    const productName = product?.name ?? item.productName?.trim();

    if (!productName) throw new ApplicationError('invalid', 'items.NAME_REQUIRED');
    if (!quantity || !unitPrice) {
      throw new ApplicationError('invalid', 'items.QUANTITY_PRICE_INVALID');
    }
    const lineAmount = this.money.multiply(unitPrice, quantity);
    if (lineAmount.isZero() || !MONEY_AMOUNT_PATTERN.test(lineAmount.toFixed()))
      throw new ApplicationError('invalid', 'items.LINE_AMOUNT_OUT_OF_RANGE');

    return {
      ...(product ? { productId: product.id } : {}),
      productCode: product?.code,
      productName,
      categoryName: product?.category.name,
      brandName: product?.brand?.name,
      quantity,
      unit: (product?.unit ?? item.unit?.trim()) || 'Cái',
      unitPrice,
      lineAmount,
    };
  }
}
