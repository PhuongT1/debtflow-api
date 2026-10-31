import { Prisma, type Party } from '@generated/prisma';
import type { SortItem } from '@common/query/list-query.types';
import { PARTY_LIST_QUERY } from './parties.list-query';

type SortableParty = Party & {
  balance: { receivable: Prisma.Decimal; payable: Prisma.Decimal };
  _count: { debts: number };
};

/** Apply every requested key in order, including keys before and after a computed balance. */
export function compareParties(left: SortableParty, right: SortableParty, sort: SortItem[]) {
  const value = (party: SortableParty, field: string) => {
    if (field === 'receivable' || field === 'payable') return party.balance[field];
    if (field === 'outstandingDocuments') return party._count.debts;
    return party[field as keyof Party];
  };

  for (const { field, direction } of sort) {
    const a = value(left, field);
    const b = value(right, field);
    let compared: number;
    // PostgreSQL defaults to NULLS LAST for ASC and NULLS FIRST for DESC.
    if (a == null || b == null) compared = a == null ? (b == null ? 0 : 1) : -1;
    else if (Prisma.Decimal.isDecimal(a)) compared = a.comparedTo(b as Prisma.Decimal);
    else if (a instanceof Date && b instanceof Date) compared = a.getTime() - b.getTime();
    else if (typeof a === 'number' && typeof b === 'number') compared = a - b;
    else if (typeof a === 'boolean' && typeof b === 'boolean') compared = Number(a) - Number(b);
    else {
      const values = PARTY_LIST_QUERY.fields[field].values;
      compared = values
        ? values.indexOf(String(a)) - values.indexOf(String(b))
        : String(a).localeCompare(String(b));
    }
    if (compared !== 0) return compared * (direction === 'desc' ? -1 : 1);
  }
  return left.id.localeCompare(right.id);
}
