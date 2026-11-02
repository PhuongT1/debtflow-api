import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { DebtStatus, Prisma } from '@generated/prisma';
import { buildDebtQuery } from '@modules/debts/public/debts';
import type { QueryDebtsDto } from '@modules/debts/public/debts';
import type { AgingReportResponseDto } from '../dto/aging-report-response.dto';
import type { ListQueryResult } from '@common/query';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async aging(
    query: QueryDebtsDto,
    organizationId: string,
    listQuery?: ListQueryResult,
  ): Promise<AgingReportResponseDto> {
    const now = new Date();
    const { where } = buildDebtQuery(organizationId, query, listQuery, now);
    const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
    // Preserve the existing floor(elapsed / 24h) bucket semantics, including exact boundaries.
    const ranges = [
      { gt: daysAgo(1) },
      { lte: daysAgo(1), gt: daysAgo(8) },
      { lte: daysAgo(8), gt: daysAgo(31) },
      { lte: daysAgo(31), gt: daysAgo(61) },
      { lte: daysAgo(61) },
    ] satisfies Prisma.DateTimeFilter[];
    const totals = await this.prisma.$transaction(
      ranges.map((dueDate) =>
        this.prisma.debt.aggregate({
          where: {
            AND: [where, { status: { in: [DebtStatus.OPEN, DebtStatus.PARTIAL] } }, { dueDate }],
          },
          _sum: { originalAmount: true, paidAmount: true },
          _count: { _all: true },
        }),
      ),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const bucket = (index: number, label: string) => ({
      label,
      amount: (totals[index]._sum.originalAmount ?? new Prisma.Decimal(0))
        .minus(totals[index]._sum.paidAmount ?? new Prisma.Decimal(0))
        .toString(),
      count: totals[index]._count._all,
    });
    return {
      notDue: bucket(0, 'Chưa đến hạn'),
      day1To7: bucket(1, 'Quá hạn 1-7 ngày'),
      day8To30: bucket(2, 'Quá hạn 8-30 ngày'),
      day31To60: bucket(3, 'Quá hạn 31-60 ngày'),
      day60Plus: bucket(4, 'Quá hạn trên 60 ngày'),
    };
  }
}
