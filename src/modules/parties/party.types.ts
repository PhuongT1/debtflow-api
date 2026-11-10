/**
 * Party data types derive from Prisma models and the exact query projections, without copied fields.
 * Runtime Swagger contracts stay in dto/; this file contains type-only dependencies and exports.
 */
import type { Party, Prisma } from '@generated/prisma/client.js';
import type { CreatePartyDto } from './dto/create-party.dto.js';
import type {
  partyListSelect,
  PARTY_DEFAULT_SELECT,
  partyDetailSelect,
} from './queries/party.select.js';

export type PartySearchSource = Pick<Party, 'name' | 'code' | 'phone' | 'taxCode'>;
export type PartyWriteData = Pick<
  Prisma.PartyUncheckedCreateInput,
  keyof CreatePartyDto | 'searchText'
>;
export type PartyBalance = { receivable: Prisma.Decimal; payable: Prisma.Decimal };
/** Inferred by Prisma from the same select passed to findMany; no copied model fields. */
export type PartyListRecord = Prisma.PartyGetPayload<{
  select: ReturnType<typeof partyListSelect>;
}>;
/** The only extension: money aggregates are computed, not columns of Party. */
export type PartyWithBalance = PartyListRecord & { balance: PartyBalance };

/** Numeric columns from the owned aggregate query are returned as Prisma Decimal values. */
export type PartyBalanceRow = Pick<Party, 'id'> & PartyBalance;

export type PartyRecord = Prisma.PartyGetPayload<{ select: typeof PARTY_DEFAULT_SELECT }>;
export type PartyDetail = Prisma.PartyGetPayload<{
  select: ReturnType<typeof partyDetailSelect>;
}>;
