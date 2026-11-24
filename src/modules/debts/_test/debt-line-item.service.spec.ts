import { prismaDebtMoneyMath } from '@common/utils/money.util.js';
import { describe, expect, it } from 'vitest';
import { Prisma } from '@generated/prisma/client.js';
import { DebtLineItemService } from '../application/debt-line-item.service.js';

describe('debt line item rules without a database dependency', () => {
  it('rejects products absent from the transaction-scoped catalog result', async () => {
    const service = new DebtLineItemService(prismaDebtMoneyMath);
    await expect(
      service.prepare(
        [{ productId: 'foreign-or-inactive', quantity: '1', unitPrice: '100' }],
        new Prisma.Decimal(100),
        [],
      ),
    ).rejects.toMatchObject({ kind: 'invalid' });
  });
  it('preserves Decimal arithmetic and rejects mismatching totals', async () => {
    const service = new DebtLineItemService(prismaDebtMoneyMath);
    const input = [{ productName: 'Manual', quantity: '2', unitPrice: '0.15' }];
    const items = await service.prepare(input, new Prisma.Decimal('0.30'), []);
    expect(items[0].lineAmount.toString()).toBe('0.3');
    await expect(service.prepare(input, new Prisma.Decimal('0.31'), [])).rejects.toMatchObject({
      kind: 'invalid',
    });
  });
  it('rounds each derived line before comparing the total with the persisted debt amount', async () => {
    const service = new DebtLineItemService(prismaDebtMoneyMath);
    const line = { productName: 'Manual', quantity: '0.5', unitPrice: '0.01' };
    const items = await service.prepare([line, line], new Prisma.Decimal('0.02'), []);
    expect(items.map(({ lineAmount }) => lineAmount.toString())).toEqual(['0.01', '0.01']);
    await expect(
      service.prepare([line, line], new Prisma.Decimal('0.01'), []),
    ).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('avoids double rounding when a large line amount is just below a half cent', async () => {
    const service = new DebtLineItemService(prismaDebtMoneyMath);
    const [line] = await service.prepare(
      [{ productName: 'Manual', quantity: '1.001', unitPrice: '9980000000000004.99' }],
      new Prisma.Decimal('9989980000000004.99'),
      [],
    );
    expect(line.lineAmount.toFixed()).toBe('9989980000000004.99');
  });
});

it('uses the scoped product identity and preserves its price snapshot', async () => {
  const service = new DebtLineItemService(prismaDebtMoneyMath);
  const [item] = await service.prepare(
    [{ productId: 'product-1', quantity: '2', unitPrice: '0.15' }],
    new Prisma.Decimal('0.30'),
    [
      {
        id: 'product-1',
        name: 'Product',
        code: 'P-1',
        category: { name: 'Category' },
        brand: null,
        unit: 'item',
      },
    ] as never,
  );
  expect(item).toMatchObject({
    productId: 'product-1',
    productName: 'Product',
    productCode: 'P-1',
    categoryName: 'Category',
    unit: 'item',
  });
  expect(item.lineAmount.toString()).toBe('0.3');
});
