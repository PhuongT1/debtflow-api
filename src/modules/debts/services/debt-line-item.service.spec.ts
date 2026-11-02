import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@generated/prisma';
import { DebtLineItemService } from './debt-line-item.service';

describe('debt line item catalog access', () => {
  it('requires tenant-owned active products using the write transaction', async () => {
    const root = vi.fn();
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new DebtLineItemService({ product: { findMany: root } } as never);
    await expect(
      service.prepare(
        [{ productId: 'foreign-or-inactive', quantity: '1', unitPrice: '100' }],
        new Prisma.Decimal(100),
        'org-1',
        { product: { findMany } } as never,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', id: { in: ['foreign-or-inactive'] }, isActive: true },
      include: { brand: true, category: true },
    });
    expect(root).not.toHaveBeenCalled();
  });
});
