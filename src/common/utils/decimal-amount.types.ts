/** Exact decimal operations used by business rules. Adapters supply the concrete decimal value. */
export interface DecimalAmount {
  toString(): string;
  toFixed(): string;
  equals(value: string | number): boolean;
  lessThan(value: string | number): boolean;
  lessThanOrEqualTo(value: string | number): boolean;
  greaterThan(value: string | number): boolean;
  isZero(): boolean;
  plus(value: string | number): DecimalAmount;
  minus(value: string | number): DecimalAmount;
}

export interface DebtMoneyMath {
  parseMoney(value: string): DecimalAmount | null;
  parseQuantity(value: string, pattern: RegExp): DecimalAmount | null;
  multiply(price: DecimalAmount, quantity: DecimalAmount): DecimalAmount;
  sum(amounts: readonly DecimalAmount[]): DecimalAmount;
  zero(): DecimalAmount;
}
