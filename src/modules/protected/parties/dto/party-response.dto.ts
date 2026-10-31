import { PartyType } from '@generated/prisma';
import { UserSummaryDto } from '@modules/protected/users/dto/user-response.dto';

export class PartyBalanceDto {
  /** Remaining amount customers owe the organization (open and partial receivables). @example "8325000" */
  receivable!: string;
  /** Remaining amount the organization owes the party (open and partial payables). @example "0" */
  payable!: string;
}

export class PartyDebtCountDto {
  debts!: number;
}

export class PartyResponseDto {
  id!: string;
  organizationId!: string;
  type!: PartyType;
  code!: string | null;
  name!: string;
  phone!: string | null;
  email!: string | null;
  taxCode!: string | null;
  address!: string | null;
  address2!: string | null;
  note!: string | null;
  provinceCode!: string | null;
  provinceName!: string | null;
  /** Decimal string. */
  creditLimit!: string | null;
  imageUrl!: string | null;
  /** False after the party was deactivated. */
  isActive!: boolean;
  createdById!: string | null;
  assignedToId!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PartyListItemDto extends PartyResponseDto {
  assignedTo!: UserSummaryDto | null;
  balance!: PartyBalanceDto;
  _count!: PartyDebtCountDto;
}

export class PartyDebtDto {
  id!: string;
  code!: string;
  type!: string;
  title!: string;
  status!: string;
  collectionStatus!: string;
  /** Decimal string. */
  originalAmount!: string;
  /** Decimal string. */
  paidAmount!: string;
  issueDate!: Date;
  dueDate!: Date;
}

export class PartyDetailDto extends PartyResponseDto {
  assignedTo!: UserSummaryDto | null;
  /** Every debt of the party, nearest due date first. */
  debts!: PartyDebtDto[];
}
