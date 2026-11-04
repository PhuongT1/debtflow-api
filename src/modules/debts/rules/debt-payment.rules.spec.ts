import { describe, expect, it } from 'vitest';
import { Prisma } from '@generated/prisma';
import { debtPaymentState } from './debt-payment.rules';

describe('debt payment state shared by application and reversal', () => {
  it.each([
    ['-0.01', '0', 'OPEN'],
    ['0', '0', 'OPEN'],
    ['0.01', '0.01', 'PARTIAL'],
    ['99.99', '99.99', 'PARTIAL'],
    ['100', '100', 'PAID'],
    ['100.01', '100.01', 'PAID'],
  ])('derives balance/status from paid amount %s', (paid, expected, status) => {
    const result = debtPaymentState(
      { originalAmount: new Prisma.Decimal('100') },
      new Prisma.Decimal(paid),
    );
    expect(result.paidAmount.toString()).toBe(expected);
    expect(result.status).toBe(status);
  });
});
