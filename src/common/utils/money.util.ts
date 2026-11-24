import type { DebtMoneyMath, DecimalAmount } from './decimal-amount.types.js';
import { Prisma } from '@generated/prisma/client.js';
import { MONEY_AMOUNT_PATTERN, MONEY_SCALE } from '@common/validation/money.constants.js';

// Allow an 18-digit price times a 14-digit quantity before rounding to the storage scale.
const ExactMoneyProduct = Prisma.Decimal.clone({ precision: 32 });

export function parsePositiveMoney(value: string): Prisma.Decimal | null {
  return parsePositiveDecimal(value, MONEY_AMOUNT_PATTERN);
}

export function parsePositiveDecimal(value: string, pattern: RegExp): Prisma.Decimal | null {
  // Existing numeric-string inputs allow an explicit plus, leading zeroes or an omitted whole part.
  if (typeof value !== 'string' || value !== value.trim()) return null;
  const normalized = value
    .replace(/^\+/, '')
    .replace(/^0+(?=\d)/, '')
    .replace(/^\./, '0.');
  if (!pattern.test(normalized)) return null;
  const amount = new Prisma.Decimal(normalized);
  return amount.isPositive() && !amount.isZero() ? amount : null;
}

/** Round each derived monetary line at the storage scale before adding it to a document. */
export function multiplyMoney(unitPrice: Prisma.Decimal, quantity: Prisma.Decimal): Prisma.Decimal {
  const product = new ExactMoneyProduct(unitPrice).times(quantity);
  return new Prisma.Decimal(product.toFixed(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP));
}

export function sumMoney(amounts: readonly Prisma.Decimal[]): Prisma.Decimal {
  return amounts.reduce((total, amount) => total.plus(amount), new Prisma.Decimal(0));
}

/** Bind framework-neutral use cases to the same Decimal arithmetic used for persistence. */
export const prismaDebtMoneyMath = {
  parseMoney: parsePositiveMoney,
  parseQuantity: parsePositiveDecimal,
  multiply: (price: DecimalAmount, quantity: DecimalAmount) =>
    multiplyMoney(new Prisma.Decimal(price.toString()), new Prisma.Decimal(quantity.toString())),
  sum: (amounts: readonly DecimalAmount[]) =>
    sumMoney(amounts.map((amount) => new Prisma.Decimal(amount.toString()))),
  zero: () => new Prisma.Decimal(0),
} satisfies DebtMoneyMath;
