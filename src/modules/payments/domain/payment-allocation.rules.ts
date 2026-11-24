import { ApplicationError } from '@common/errors/application-error.js';
import type { DecimalAmount } from '@common/utils/decimal-amount.types.js';
import type { PayableDebt, PaymentAllocation } from './payable-debt.types.js';

export function paymentAmount(
  value: string,
  parseMoney: (value: string) => DecimalAmount | null,
): DecimalAmount {
  const amount = parseMoney(value);
  if (!amount) throw new ApplicationError('invalid', 'payments.AMOUNT_MUST_BE_POSITIVE');
  return amount;
}

export function assertPayableDebt(
  debt: Pick<PayableDebt, 'originalAmount' | 'paidAmount' | 'status'>,
  amount: DecimalAmount,
) {
  if (debt.status === 'CANCELLED')
    throw new ApplicationError('invalid', 'payments.CANNOT_PAY_CANCELLED_DEBT');
  if (debt.status === 'PAID') throw new ApplicationError('invalid', 'payments.DEBT_FULLY_PAID');
  if (amount.greaterThan(debt.originalAmount.minus(debt.paidAmount.toString()).toString()))
    throw new ApplicationError('invalid', 'payments.AMOUNT_EXCEEDS_REMAINING');
}

/** Pure allocation in caller-supplied priority order; service owns tenant scope and transaction. */
export function allocatePayment(
  debts: readonly PayableDebt[],
  amount: DecimalAmount,
): PaymentAllocation[] {
  let unapplied = amount;
  const allocations: PaymentAllocation[] = [];
  for (const debt of debts) {
    if (unapplied.lessThanOrEqualTo(0)) break;
    const remaining = debt.originalAmount.minus(debt.paidAmount.toString());
    if (remaining.lessThanOrEqualTo(0)) continue;
    const allocated = remaining.lessThan(unapplied.toString()) ? remaining : unapplied;
    assertPayableDebt(debt, allocated);
    allocations.push({ amount: allocated, debt });
    unapplied = unapplied.minus(allocated.toString());
  }
  if (unapplied.greaterThan(0))
    throw new ApplicationError('invalid', 'payments.AMOUNT_EXCEEDS_PARTY_BALANCE');
  if (allocations.length === 0)
    throw new ApplicationError('invalid', 'payments.NO_DEBT_TO_ALLOCATE');
  return allocations;
}
