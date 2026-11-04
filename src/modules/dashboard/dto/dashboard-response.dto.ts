import { PickType } from '@nestjs/swagger';
import { DebtRecordDto } from '@modules/debts/public/debt-records.js';
import { DebtWithPartyDto } from '@modules/debts/public/debt-responses.js';
import { PaymentWithPartyDto, PaymentPartyDto } from '@modules/payments/public/payments.js';
import { UserSummaryDto } from '@modules/users/public/users.js';

export class DashboardDebtTotalsDto {
  /** Decimal string. */
  original!: string;
  /** Decimal string. */
  paid!: string;
  /** Decimal string. */
  remaining!: string;
}
export class DashboardOutstandingDto {
  count!: number;
  partyCount!: number;
  /** Decimal string. */
  remaining!: string;
}
export class DashboardDirectionDto {
  dueNextSevenDays!: DashboardOutstandingDto;
  outstanding!: DashboardOutstandingDto;
  overdue!: DashboardOutstandingDto;
}
export class DashboardCashFlowDto {
  /** Decimal string. */
  expectedIn!: string;
  /** Decimal string. */
  expectedOut!: string;
  /** Decimal string. */
  net!: string;
}
export class DashboardAssigneeDto extends PickType(UserSummaryDto, ['id', 'name'] as const) {}
export class DashboardQueueItemDto extends PickType(DebtRecordDto, [
  'id',
  'code',
  'type',
  'title',
  'originalAmount',
  'paidAmount',
  'dueDate',
  'nextFollowUpAt',
  'collectionStatus',
] as const) {
  party!: PaymentPartyDto;
  assignedTo!: DashboardAssigneeDto | null;
  /** Decimal string. */
  remainingAmount!: string;
}
export class DashboardQueuesDto {
  collect!: DashboardQueueItemDto[];
  followUp!: DashboardQueueItemDto[];
  pay!: DashboardQueueItemDto[];
}
export class DashboardTradeTotalDto {
  /** Decimal string. */
  amount!: string;
  count!: number;
}
export class DashboardCategorySalesDto {
  category!: string;
  /** Decimal string. */
  amount!: string;
}
export class DashboardTradePeriodDto {
  cashIn!: DashboardTradeTotalDto;
  cashOut!: DashboardTradeTotalDto;
  purchases!: DashboardTradeTotalDto;
  sales!: DashboardTradeTotalDto;
  categorySales!: DashboardCategorySalesDto[];
}
export class DashboardTradeDto {
  period!: DashboardTradePeriodDto;
}
export class DashboardActionCenterDto {
  asOf!: string;
  receivable!: DashboardDirectionDto;
  payable!: DashboardDirectionDto;
  cashFlow!: DashboardCashFlowDto;
  queues!: DashboardQueuesDto;
  trade!: DashboardTradeDto;
}
export class DashboardResponseDto {
  receivable!: DashboardDebtTotalsDto;
  payable!: DashboardDebtTotalsDto;
  overdueCount!: number;
  actionCenter!: DashboardActionCenterDto;
  recentPayments!: PaymentWithPartyDto[];
  topDebts!: DebtWithPartyDto[];
}
