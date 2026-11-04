import { DebtStatus, Prisma, type Debt } from '@generated/prisma/client.js';

/** Shared by payment application and reversal; preserve the existing nonnegative balance rule. */
export function debtPaymentState(debt: Pick<Debt, 'originalAmount'>, paidAmount: Prisma.Decimal) {
  const nextPaidAmount = Prisma.Decimal.max(paidAmount, new Prisma.Decimal(0));
  const status = nextPaidAmount.greaterThanOrEqualTo(debt.originalAmount)
    ? DebtStatus.PAID
    : nextPaidAmount.lessThanOrEqualTo(0)
      ? DebtStatus.OPEN
      : DebtStatus.PARTIAL;
  return { paidAmount: nextPaidAmount, status };
}
