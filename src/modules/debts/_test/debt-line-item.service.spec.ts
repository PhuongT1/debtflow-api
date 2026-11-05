import { describe, expect, it } from 'vitest';
import { Prisma } from '@generated/prisma/client.js';
import { DebtLineItemService } from '../services/debt-line-item.service.js';

describe('debt line item rules without a database dependency', () => {
  it('rejects products absent from the transaction-scoped catalog result', async () => {
    const service = new DebtLineItemService();
    await expect(
      service.prepare(
        [{ productId: 'foreign-or-inactive', quantity: '1', unitPrice: '100' }],
        new Prisma.Decimal(100),
        [],
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('preserves Decimal arithmetic and rejects mismatching totals', async () => {
    const service = new DebtLineItemService();
    const input = [{ productName: 'Manual', quantity: '2', unitPrice: '0.15' }];
    const items = await service.prepare(input, new Prisma.Decimal('0.30'), []);
    expect(items[0].lineAmount.toString()).toBe('0.3');
    await expect(service.prepare(input, new Prisma.Decimal('0.31'), [])).rejects.toMatchObject({
      status: 400,
    });
  });
});

it('uses the scoped product identity and preserves its price snapshot', async () => {
  const service = new DebtLineItemService();
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
