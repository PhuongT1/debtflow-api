import { badRequest } from '@common/errors/app-errors.js';
import { DebtStatus, Prisma } from '@generated/prisma/client.js';
import type { PayableDebt, VoucherInput } from '../types/payment.types.js';

export function paymentAmount(value: string): Prisma.Decimal {
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw badRequest('payments.AMOUNT_MUST_BE_POSITIVE');
  }
  if (!amount.isFinite() || amount.lessThanOrEqualTo(0))
    throw badRequest('payments.AMOUNT_MUST_BE_POSITIVE');
  return amount;
}

export function assertPayableDebt(
  debt: Pick<PayableDebt, 'originalAmount' | 'paidAmount' | 'status'>,
  amount: Prisma.Decimal,
) {
  if (debt.status === DebtStatus.CANCELLED) throw badRequest('payments.CANNOT_PAY_CANCELLED_DEBT');
  if (debt.status === DebtStatus.PAID) throw badRequest('payments.DEBT_FULLY_PAID');
  if (amount.greaterThan(debt.originalAmount.minus(debt.paidAmount)))
    throw badRequest('payments.AMOUNT_EXCEEDS_REMAINING');
}

/** Pure allocation in caller-supplied priority order; service owns tenant scope and transaction. */
export function allocatePayment(
  debts: readonly PayableDebt[],
  amount: Prisma.Decimal,
): VoucherInput['allocations'] {
  let unapplied = amount;
  const allocations: VoucherInput['allocations'] = [];
  for (const debt of debts) {
    if (unapplied.lessThanOrEqualTo(0)) break;
    const remaining = debt.originalAmount.minus(debt.paidAmount);
    if (remaining.lessThanOrEqualTo(0)) continue;
    const allocated = Prisma.Decimal.min(remaining, unapplied);
    assertPayableDebt(debt, allocated);
    allocations.push({ amount: allocated, debt });
    unapplied = unapplied.minus(allocated);
  }
  if (unapplied.greaterThan(0)) throw badRequest('payments.AMOUNT_EXCEEDS_PARTY_BALANCE');
  if (allocations.length === 0) throw badRequest('payments.NO_DEBT_TO_ALLOCATE');
  return allocations;
}
