import { Injectable } from '@nestjs/common';
import { DebtStatus, DebtType, Prisma } from '@generated/prisma';
import { PrismaService } from '@database/prisma.service';
import { DashboardActionCenterService } from './dashboard-action-center.service';
import { DashboardQueryDto } from './dto/query-dashboard.dto';

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
    const periodEnd = query.dateTo
      ? new Date(query.dateTo + 'T23:59:59.999+07:00')
      : undefined;
    const paymentPeriod = periodStart || periodEnd ? { gte: periodStart, lte: periodEnd } : undefined;
    const [debts, recentPayments, topDebts] = await Promise.all([
      this.prisma.debt.findMany({ where: { organizationId, status: { not: DebtStatus.CANCELLED } } }),
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
    const receivable = debts.filter((debt) => debt.type === DebtType.RECEIVABLE);
    const payable = debts.filter((debt) => debt.type === DebtType.PAYABLE);
    const now = new Date();

    return {
      receivable: {
        original: sum(receivable, 'originalAmount'),
        paid: sum(receivable, 'paidAmount'),
        remaining: sum(receivable, 'originalAmount').minus(sum(receivable, 'paidAmount')),
      },
      payable: {
        original: sum(payable, 'originalAmount'),
        paid: sum(payable, 'paidAmount'),
        remaining: sum(payable, 'originalAmount').minus(sum(payable, 'paidAmount')),
      },
      overdueCount: debts.filter((debt) => debt.dueDate < now && debt.status !== DebtStatus.PAID)
        .length,
      actionCenter,
      recentPayments,
      topDebts,
    };
  }
}
