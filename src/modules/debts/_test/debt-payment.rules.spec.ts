import { describe, expect, it } from 'vitest';
import { Prisma } from '@generated/prisma/client.js';
import { debtPaymentState } from '../domain/debt-payment.rules.js';

describe('debt payment state shared by application and reversal', () => {
  it.each([
    ['0', '0', 'OPEN'],
    ['0.01', '0.01', 'PARTIAL'],
    ['99.99', '99.99', 'PARTIAL'],
    ['100', '100', 'PAID'],
  ])('derives balance/status from paid amount %s', (paid, expected, status) => {
    const result = debtPaymentState(
      { originalAmount: new Prisma.Decimal('100') },
      new Prisma.Decimal(paid),
    );
    expect(result.paidAmount.toString()).toBe(expected);
    expect(result.status).toBe(status);
  });
  it.each(['-0.01', '100.01'])('rejects an inconsistent paid amount %s', (paid) => {
    expect(() =>
      debtPaymentState({ originalAmount: new Prisma.Decimal(100) }, new Prisma.Decimal(paid)),
    ).toThrow(expect.objectContaining({ kind: 'conflict' }));
  });
});
