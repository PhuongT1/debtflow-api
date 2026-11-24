import { ApplicationError } from '@common/errors/application-error.js';
import type { DecimalAmount } from '@common/utils/decimal-amount.types.js';

/** Reject an inconsistent balance before deriving its payment status. */
export function debtPaymentState(
  debt: { originalAmount: DecimalAmount },
  paidAmount: DecimalAmount,
) {
  if (paidAmount.lessThan(0) || paidAmount.greaterThan(debt.originalAmount.toString()))
    throw new ApplicationError('conflict', 'debts.INCONSISTENT_PAYMENT_BALANCE');
  const status = paidAmount.equals(debt.originalAmount.toString())
    ? 'PAID'
    : paidAmount.isZero()
      ? 'OPEN'
      : 'PARTIAL';
  return { paidAmount, status } as const;
}
