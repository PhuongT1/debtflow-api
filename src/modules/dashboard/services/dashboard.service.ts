import { Injectable } from '@nestjs/common';
import { DebtStatus, DebtType, Prisma } from '@generated/prisma';
import { PrismaService } from '@database/prisma.service';
import { DashboardActionCenterService } from './dashboard-action-center.service';
import { DashboardQueryDto } from '../dto/query-dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actionCenter: DashboardActionCenterService,
  ) {}

  async get(query: DashboardQueryDto, organizationId: string) {
    const actionCenter = await this.actionCenter.get(query, organizationId);
    const periodStart = query.dateFrom
      ? new Date(query.dateFrom + 'T00:00:00.000+07:00')
      : undefined;
    const periodEnd = query.dateTo ? new Date(query.dateTo + 'T23:59:59.999+07:00') : undefined;
    const paymentPeriod =
      periodStart || periodEnd ? { gte: periodStart, lte: periodEnd } : undefined;
    const [debts, recentPayments, topDebts] = await Promise.all([
      this.prisma.debt.findMany({
        where: { organizationId, status: { not: DebtStatus.CANCELLED } },
      }),
      this.prisma.payment.findMany({
        orderBy: { paidAt: 'desc' },
        where: { organizationId, ...(paymentPeriod ? { paidAt: paymentPeriod } : {}) },
        take: 8,
        include: { party: true },
      }),
      this.prisma.debt.findMany({
        where: { organizationId, status: { notIn: [DebtStatus.PAID, DebtStatus.CANCELLED] } },
        orderBy: { dueDate: 'asc' },
        take: 8,
        include: { party: true },
      }),
    ]);

    const sum = (items: typeof debts, field: 'originalAmount' | 'paidAmount') =>
      items.reduce((total, debt) => total.plus(debt[field]), new Prisma.Decimal(0));
    const totals = (type: DebtType) => {
      const items = debts.filter((debt) => debt.type === type);
      const original = sum(items, 'originalAmount');
      const paid = sum(items, 'paidAmount');
      return { original, paid, remaining: original.minus(paid) };
    };
    const now = new Date();

    return {
      receivable: totals(DebtType.RECEIVABLE),
      payable: totals(DebtType.PAYABLE),
      overdueCount: debts.filter((debt) => debt.dueDate < now && debt.status !== DebtStatus.PAID)
        .length,
      actionCenter,
      recentPayments,
      topDebts,
    };
  }
}
