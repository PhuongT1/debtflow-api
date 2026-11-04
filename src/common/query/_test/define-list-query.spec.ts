import { describe, expect, it } from 'vitest';
import { defineListQuery } from '../define-list-query.js';

describe('generated list-query schema validation', () => {
  it('accepts scalar, enum, relation paths and computed fields from the real schema', () => {
    expect(() =>
      defineListQuery({
        model: 'Party',
        fields: {
          name: { type: 'string' },
          type: { type: 'enum' },
          creditLimit: { type: 'decimal' },
          createdAt: { type: 'date' },
          active: { type: 'boolean', path: 'isActive' },
          organization: { type: 'string', path: 'organization.name' },
          receivable: { type: 'decimal', computed: true },
        },
      }),
    ).not.toThrow();
  });

  it('fails at startup for unknown models, renamed fields and mismatched types', () => {
    expect(() => defineListQuery({ model: 'Missing', fields: {} })).toThrow('unknown Prisma model');
    expect(() => defineListQuery({ model: 'Party', fields: { typo: { type: 'string' } } })).toThrow(
      'does not exist',
    );
    expect(() => defineListQuery({ model: 'Party', fields: { name: { type: 'date' } } })).toThrow(
      'declared as "date"',
    );
    expect(() =>
      defineListQuery({ model: 'Party', fields: { invalid: { type: 'string', path: 'name.id' } } }),
    ).toThrow('not a relation');
  });
});
