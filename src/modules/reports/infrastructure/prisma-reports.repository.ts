import type { ListQueryResult } from '@common/query/index.js';
import { PrismaService } from '@database/prisma.service.js';
import { DebtStatus, Prisma } from '@generated/prisma/client.js';
import type { QueryDebtsDto } from '@modules/debts/public/debts.js';
import {
  buildDebtQuery,
  DEBT_AGING_VALUES,
  getDebtAgingRanges,
} from '@modules/debts/public/debts.js';
import { Injectable } from '@nestjs/common';
import type { AgingReportResponseDto } from '../dto/aging-report-response.dto.js';
import { ReportsRepository } from '../repositories/reports.repository.js';

@Injectable()
export class PrismaReportsRepository extends ReportsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async aging(
    query: QueryDebtsDto,
    organizationId: string,
    listQuery?: ListQueryResult,
  ): Promise<AgingReportResponseDto> {
    const now = new Date();
    const { where } = buildDebtQuery(organizationId, query, listQuery, now);
    const ranges = getDebtAgingRanges(now);
    const totals = await this.prisma.$transaction(
      DEBT_AGING_VALUES.map((key) =>
        this.prisma.debt.aggregate({
          where: {
            AND: [
              where,
              { status: { in: [DebtStatus.OPEN, DebtStatus.PARTIAL] } },
              { dueDate: ranges[key] },
            ],
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
