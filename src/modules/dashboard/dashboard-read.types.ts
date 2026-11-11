import type { Prisma } from '@generated/prisma/client.js';
import type {
  DashboardActionCenterDto,
  DashboardResponseDto,
} from './dto/dashboard-response.dto.js';

/** Same response projection before Decimal serialization at the HTTP boundary. */
type MonetaryKey =
  | 'original'
  | 'paid'
  | 'remaining'
  | 'expectedIn'
  | 'expectedOut'
  | 'net'
  | 'amount'
  | 'originalAmount'
  | 'paidAmount'
  | 'remainingAmount'
  | 'creditLimit'
  | 'unitPrice'
  | 'lineAmount';
type ReadModel<T> = T extends Date
  ? Date
  : T extends readonly (infer Item)[]
    ? ReadModel<Item>[]
    : T extends object
      ? {
          [Key in keyof T]: Key extends MonetaryKey
            ? Prisma.Decimal | Extract<T[Key], null>
            : ReadModel<T[Key]>;
        }
      : T;
export type DashboardActionCenter = ReadModel<DashboardActionCenterDto>;
export type DashboardSummary = Omit<ReadModel<DashboardResponseDto>, 'actionCenter'>;
