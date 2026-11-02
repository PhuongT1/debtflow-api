import { describe, expect, it, vi } from 'vitest';
import { DebtsService } from './debts.service';

describe('debt query and required tenant context', () => {
  it.each([undefined, null, '', ' '])(
    'rejects tenant %s before reads, writes or audit publication',
    async (organizationId) => {
      const transaction = vi.fn();
      const findFirstOrThrow = vi.fn();
      const create = vi.fn();
      const events = { emit: vi.fn() };
      const service = new DebtsService(
        { $transaction: transaction, debt: { findFirstOrThrow, create } } as never,
        {} as never,
        events as never,
      );
      await expect(service.list(organizationId as never, {})).rejects.toMatchObject({
        status: 403,
      });
      await expect(service.detail('d1', organizationId as never)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        service.create({} as never, organizationId as never, 'actor'),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.updateCollection('d1', {} as never, organizationId as never),
      ).rejects.toMatchObject({ status: 403 });
      await expect(service.cancel('d1', organizationId as never)).rejects.toMatchObject({
        status: 403,
      });
      expect(transaction).not.toHaveBeenCalled();
      expect(findFirstOrThrow).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    },
  );
});
