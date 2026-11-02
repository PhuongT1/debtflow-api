import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ListQueryAwareValidationPipe } from '@common/query';
import { CreateDebtDto } from './create-debt.dto';
import { UpdateDebtCollectionDto } from './update-debt-collection.dto';

const pipe = new ListQueryAwareValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('derived debt request DTOs', () => {
  it('inherits only the editable collection fields, preserving optional/null semantics', async () => {
    const metadata = { type: 'body' as const, metatype: UpdateDebtCollectionDto };
    await expect(pipe.transform({}, metadata)).resolves.toBeInstanceOf(UpdateDebtCollectionDto);
    await expect(
      pipe.transform({ invoiceNo: null, nextFollowUpAt: null, assignedToId: null }, metadata),
    ).resolves.toMatchObject({ invoiceNo: null, nextFollowUpAt: null, assignedToId: null });
    await expect(pipe.transform({ invoiceNo: 123 }, metadata)).rejects.toMatchObject({
      status: 400,
    });
    await expect(pipe.transform({ collectionStatus: null }, metadata)).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      pipe.transform({ nextFollowUpAt: 'invalid', collectionStatus: 'invalid' }, metadata),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects create-only and nested item fields on a collection update', async () => {
    for (const field of ['originalAmount', 'type', 'partyId', 'items', 'organizationId']) {
      await expect(
        pipe.transform(
          { [field]: 'not-editable' },
          { type: 'body', metatype: UpdateDebtCollectionDto },
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
  });

  it('still validates nested item inputs after grouping them under dto/items', async () => {
    const value = {
      type: 'RECEIVABLE',
      partyId: 'p1',
      title: 'Invoice',
      originalAmount: '100',
      issueDate: '2026-11-01',
      dueDate: '2026-11-02',
      items: [{ productName: 'Item', quantity: '2', unitPrice: '50' }],
    };
    await expect(
      pipe.transform(value, { type: 'body', metatype: CreateDebtDto }),
    ).resolves.toBeInstanceOf(CreateDebtDto);
    await expect(
      pipe.transform(
        { ...value, items: [{ ...value.items[0], quantity: 'bad' }] },
        { type: 'body', metatype: CreateDebtDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
