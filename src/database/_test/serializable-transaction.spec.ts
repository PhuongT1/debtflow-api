import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@generated/prisma/client.js';
import { serializableTransaction } from '../serializable-transaction.js';

const conflict = () =>
  new Prisma.PrismaClientKnownRequestError('synthetic conflict', {
    code: 'P2034',
    clientVersion: 'test',
  });
describe('serializable write boundary', () => {
  it('retries conflicts with a fresh transaction and returns only committed results', async () => {
    const tx = {};
    const work = vi.fn().mockResolvedValue('committed');
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(conflict())
      .mockImplementation(async (run) => run(tx));
    expect(await serializableTransaction({ $transaction: transaction } as never, work)).toBe(
      'committed',
    );
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenLastCalledWith(work, { isolationLevel: 'Serializable' });
    expect(work).toHaveBeenCalledWith(tx);
  });
  it('bounds retries and propagates a persistent conflict', async () => {
    const transaction = vi.fn().mockRejectedValue(conflict());
    await expect(
      serializableTransaction({ $transaction: transaction } as never, vi.fn()),
    ).rejects.toMatchObject({ code: 'P2034' });
    expect(transaction).toHaveBeenCalledTimes(3);
  });
  it('never retries business failures or unrelated database errors', async () => {
    const failure = new Error('business validation');
    const transaction = vi.fn().mockRejectedValue(failure);
    await expect(
      serializableTransaction({ $transaction: transaction } as never, vi.fn()),
    ).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
