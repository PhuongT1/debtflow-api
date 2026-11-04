import { describe, expect, it } from 'vitest';
import { Prisma } from '#generated/prisma/client.js';
import type { PayableDebt } from '../types/payment.types.js';
import { allocatePayment, assertPayableDebt, paymentAmount } from './payment-allocation.rules.js';

function debt(id: string, original: string, paid = '0'): PayableDebt {
  return {
    id,
    organizationId: 'org-1',
    partyId: 'p1',
    type: 'RECEIVABLE',
    status: 'OPEN',
    originalAmount: new Prisma.Decimal(original),
    paidAmount: new Prisma.Decimal(paid),
  };
}

describe('payment allocation rules', () => {
  it.each(['0', '-1', 'NaN', 'Infinity', '-Infinity', 'invalid'])(
    'rejects invalid/nonpositive amount %s',
    (value) => {
      expect(() => paymentAmount(value)).toThrow(expect.objectContaining({ status: 400 }));
    },
  );

  it('allocates exact decimal amounts in the supplied priority order without mutating debts', () => {
    const debts = [debt('oldest', '0.30', '0.20'), debt('next', '0.40')];
    const result = allocatePayment(debts, paymentAmount('0.35'));
    expect(result.map(({ debt, amount }) => [debt.id, amount.toString()])).toEqual([
      ['oldest', '0.1'],
      ['next', '0.25'],
    ]);
    expect(debts.map(({ paidAmount }) => paidAmount.toString())).toEqual(['0.2', '0']);
    expect(
      result.reduce((total, { amount }) => total.plus(amount), new Prisma.Decimal(0)).toString(),
    ).toBe('0.35');
  });

  it('skips exhausted debts and stops once the requested amount is fully allocated', () => {
    const debts = [debt('exhausted', '10', '10'), debt('chosen', '20'), debt('later', '30')];
    const result = allocatePayment(debts, paymentAmount('20'));
    expect(result.map(({ debt }) => debt.id)).toEqual(['chosen']);
    expect(result[0].amount.toString()).toBe('20');
  });

  it('rejects an amount exceeding all remaining balances, including an empty selection', () => {
    for (const debts of [[], [debt('d1', '10', '5')]])
      expect(() => allocatePayment(debts, paymentAmount('6'))).toThrow(
        expect.objectContaining({ status: 400 }),
      );
  });

  it.each(['PAID', 'CANCELLED'] as const)('rejects a debt in state %s', (status) => {
    expect(() => assertPayableDebt({ ...debt('d1', '100'), status }, paymentAmount('1'))).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it('permits exact settlement and rejects even a small overpayment', () => {
    const item = debt('d1', '9007199254740993.25', '9007199254740993.20');
    expect(() => assertPayableDebt(item, paymentAmount('0.05'))).not.toThrow();
    expect(() => assertPayableDebt(item, paymentAmount('0.06'))).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });
});
