import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ListQueryAwareValidationPipe } from '#common/query/index.js';
import { CreateAllocatedPaymentDto } from './create-allocated-payment.dto.js';

const pipe = new ListQueryAwareValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const metadata = { type: 'body' as const, metatype: CreateAllocatedPaymentDto };
const valid = {
  amount: '10.25',
  paidAt: '2026-11-01',
  partyId: 'p1',
  type: 'RECEIVABLE',
  note: 'test',
};

describe('allocated payment DTO inheritance', () => {
  it('inherits payment fields and validators while adding allocation context', async () => {
    await expect(pipe.transform(valid, metadata)).resolves.toBeInstanceOf(
      CreateAllocatedPaymentDto,
    );
    for (const field of ['amount', 'paidAt', 'partyId', 'type']) {
      const input: Record<string, unknown> = { ...valid };
      delete input[field];
      await expect(pipe.transform(input, metadata)).rejects.toMatchObject({ status: 400 });
    }
  });
  it('rejects invalid inherited values, payment method and unknown tenant fields', async () => {
    for (const invalid of [
      { amount: 'bad' },
      { paidAt: 'bad' },
      { method: 'invalid' },
      { organizationId: 'foreign' },
    ]) {
      await expect(pipe.transform({ ...valid, ...invalid }, metadata)).rejects.toMatchObject({
        status: 400,
      });
    }
  });
});
