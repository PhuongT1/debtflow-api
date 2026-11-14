import { DebtRecordDto } from '@modules/debts/public/debt-records.js';
import { ApiProperty, PickType } from '@nestjs/swagger';
import { PartyBase } from '@generated/response-models/party-base.js';
import { PARTY_RESPONSE_FIELDS } from './party-response.fields.js';
import { UserSummaryDto } from '@modules/users/public/users.js';

export class PartyBalanceDto {
  /** Remaining amount customers owe the organization (open and partial receivables). @example "8325000" */
  receivable!: string;
  /** Remaining amount the organization owes the party (open and partial payables). @example "0" */
  payable!: string;
}

export class PartyDebtCountDto {
  debts!: number;
}

/** Shared scalar contract; only the money representation differs from the generated base. */
export class PartyResponseDto extends PickType(PartyBase, PARTY_RESPONSE_FIELDS) {
  /** Decimal string. */
  @ApiProperty({ type: String, nullable: true })
  creditLimit!: string | null;
}

export class PartyListItemDto extends PartyResponseDto {
  assignedTo!: UserSummaryDto | null;
  balance!: PartyBalanceDto;
  _count!: PartyDebtCountDto;
}

export class PartyDebtDto extends DebtRecordDto {}

export class PartyDetailDto extends PartyResponseDto {
  assignedTo!: UserSummaryDto | null;
  /** Every debt of the party, nearest due date first. */
  debts!: PartyDebtDto[];
}
