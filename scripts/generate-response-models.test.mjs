import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderResponseModel } from './generate-response-models.mjs';

const field = (name, type, extra = {}) => ({
  name,
  type,
  kind: 'scalar',
  isRequired: true,
  ...extra,
});

test('generates scalar metadata, real enums and required nullable fields without relations', () => {
  const source = renderResponseModel({
    name: 'Party',
    fields: [
      field('id', 'String'),
      field('phone', 'String', { isRequired: false }),
      field('creditLimit', 'Decimal', { isRequired: false }),
      field('createdAt', 'DateTime'),
      field('type', 'PartyType', { kind: 'enum' }),
      field('debts', 'Debt', { kind: 'object', isList: true }),
    ],
  });
  assert.match(source, /required: true, nullable: true.*\n  phone!: string \| null/);
  assert.match(source, /creditLimit!: Prisma.Decimal \| null/);
  assert.match(source, /type: Date/);
  assert.match(source, /enum: PartyType/);
  assert.doesNotMatch(source, /debts/);
});

test('new schema fields are generated, while unsupported scalars fail instead of becoming any', () => {
  const source = renderResponseModel({ name: 'Party', fields: [field('internalNote', 'String')] });
  assert.match(source, /internalNote!: string/);
  assert.throws(
    () => renderResponseModel({ name: 'Party', fields: [field('payload', 'Unsupported')] }),
    /Unsupported response scalar/,
  );
});
