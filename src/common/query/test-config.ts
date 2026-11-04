import { HttpException } from '@nestjs/common';
import type { ListQueryConfig } from './list-query.types.js';

/** Shared fixture for the list query specs: one field of each type plus the special cases. */
export const TEST_CONFIG: ListQueryConfig = {
  fields: {
    code: { type: 'string' },
    status: { type: 'enum', values: ['OPEN', 'PAID', 'CANCELLED'] },
    amount: { type: 'decimal' },
    quantity: { type: 'number' },
    dueDate: { type: 'date' },
    isActive: { type: 'boolean' },
    note: { type: 'string', nullable: true },
    partyName: { type: 'string', path: 'party.name' },
    secret: { type: 'string', filterable: false, sortable: false },
    createdAt: { type: 'date', filterable: false },
    docs: {
      type: 'number',
      filterable: false,
      sort: (direction) => ({ debts: { _count: direction } }),
    },
    balance: { type: 'decimal', computed: true },
  },
};

/** Runs `fn` and returns the `{ code, params }` of the HttpException it throws. */
export function errorOf(fn: () => unknown): { code?: string; params?: Record<string, unknown> } {
  try {
    fn();
  } catch (error) {
    if (error instanceof HttpException) {
      return error.getResponse() as { code?: string; params?: Record<string, unknown> };
    }
    throw error;
  }
  throw new Error('Expected the function to throw');
}
