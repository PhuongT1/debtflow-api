import type { DashboardQueryDto } from '../dto/query-dashboard.dto.js';
import { Injectable } from '@nestjs/common';
import { badRequest } from '@common/errors/app-errors.js';
import {
  addBusinessDays,
  formatBusinessDate,
  getBusinessDayRange,
} from '@common/utils/business-date.util.js';
import { DebtStatus, DebtType, Prisma } from '@generated/prisma/client.js';
import { PrismaService } from '@database/prisma.service.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { getDashboardPeriod } from '../queries/dashboard.query.js';

const ACTIVE_DEBT_STATUSES = [DebtStatus.OPEN, DebtStatus.PARTIAL];
const QUEUE_LIMIT = 6;

type DebtScope = Pick<Prisma.DebtWhereInput, 'dueDate' | 'status' | 'type'>;

@Injectable()
export class DashboardActionCenterService {
  constructor(private readonly prisma: PrismaService) {}

  async get(period: DashboardQueryDto | undefined, organizationId: string) {
    requireOrganizationId(organizationId);
    const { end: endOfToday, start: startOfToday } = getBusinessDayRange();
    const range = getDashboardPeriod(period);
    const periodStart = range.start ?? startOfToday;
    const periodEnd = range.end ?? endOfToday;

    if (periodStart > periodEnd) {
      throw badRequest('parties.INVALID_DATE_RANGE');
    }
    const endOfNextSevenDays = addBusinessDays(endOfToday, 6);
    const receivable = this.scope(DebtType.RECEIVABLE, organizationId);
    const payable = this.scope(DebtType.PAYABLE, organizationId);

    const [
      receivableOutstanding,
      payableOutstanding,
      receivableOverdue,
      payableOverdue,
      receivableDueNextSevenDays,
      payableDueNextSevenDays,
      collect,
      pay,
      followUp,
      periodTrade,
      periodCategorySales,
    ] = await Promise.all([
      this.getSummary(receivable),
      this.getSummary(payable),
      this.getSummary({ ...receivable, dueDate: { lt: startOfToday } }),
      this.getSummary({ ...payable, dueDate: { lt: startOfToday } }),
      this.getSummary({ ...receivable, dueDate: { gte: startOfToday, lte: endOfNextSevenDays } }),
      this.getSummary({ ...payable, dueDate: { gte: startOfToday, lte: endOfNextSevenDays } }),
      this.getQueue({ ...receivable, dueDate: { lte: endOfToday } }),
      this.getQueue({ ...payable, dueDate: { lte: endOfToday } }),
      this.getQueue({ ...receivable, nextFollowUpAt: { lte: endOfToday } }),
      this.getTradeSummary(periodStart, periodEnd, organizationId),
      this.getCategorySales(periodStart, periodEnd, organizationId),
    ]);

    return {
      asOf: formatBusinessDate(),
      receivable: {
        dueNextSevenDays: receivableDueNextSevenDays,
        outstanding: receivableOutstanding,
        overdue: receivableOverdue,
      },
      payable: {
        dueNextSevenDays: payableDueNextSevenDays,
        outstanding: payableOutstanding,
        overdue: payableOverdue,
      },
      cashFlow: {
        expectedIn: receivableDueNextSevenDays.remaining,
        expectedOut: payableDueNextSevenDays.remaining,
        net: receivableDueNextSevenDays.remaining.minus(payableDueNextSevenDays.remaining),
      },
      queues: { collect, followUp, pay },
      trade: { period: { ...periodTrade, categorySales: periodCategorySales } },
    };
  }

  private async getCategorySales(start: Date, end: Date, organizationId: string) {
    const items = await this.prisma.debtItem.groupBy({
      by: ['categoryName'],
      where: {
        debt: {
          organizationId,
          type: DebtType.RECEIVABLE,
          status: { not: DebtStatus.CANCELLED },
          issueDate: { gte: start, lte: end },
        },
      },
      _sum: { lineAmount: true },
    });
    const totals = new Map<string, Prisma.Decimal>();

    items.forEach((item) => {
      const category = item.categoryName ?? 'Chưa phân loại';
      totals.set(
        category,
        (totals.get(category) ?? new Prisma.Decimal(0)).plus(item._sum.lineAmount ?? 0),
      );
    });

    return Array.from(totals, ([category, amount]) => ({ category, amount }))
      .sort((left, right) => right.amount.comparedTo(left.amount))
      .slice(0, 5);
  }

  private async getTradeSummary(start: Date, end: Date, organizationId: string) {
    const issueDate = { gte: start, lte: end };
    const debtTotal = (type: DebtType) =>
      this.prisma.debt.aggregate({
        where: { organizationId, type, status: { not: DebtStatus.CANCELLED }, issueDate },
        _count: { _all: true },
        _sum: { originalAmount: true },
      });
    const paymentTotal = (type: DebtType) =>
      this.prisma.payment.aggregate({
        where: { organizationId, type, paidAt: { gte: start, lte: end } },
        _count: { _all: true },
        _sum: { amount: true },
      });
    const [sales, purchases, cashIn, cashOut] = await Promise.all([
      debtTotal(DebtType.RECEIVABLE),
      debtTotal(DebtType.PAYABLE),
      paymentTotal(DebtType.RECEIVABLE),
      paymentTotal(DebtType.PAYABLE),
    ]);

    return {
      cashIn: { amount: cashIn._sum.amount ?? new Prisma.Decimal(0), count: cashIn._count._all },
      cashOut: { amount: cashOut._sum.amount ?? new Prisma.Decimal(0), count: cashOut._count._all },
      purchases: {
        amount: purchases._sum.originalAmount ?? new Prisma.Decimal(0),
        count: purchases._count._all,
      },
      sales: {
        amount: sales._sum.originalAmount ?? new Prisma.Decimal(0),
        count: sales._count._all,
      },
    };
  }

  private scope(type: DebtType, organizationId: string): DebtScope & { organizationId: string } {
    return { organizationId, status: { in: ACTIVE_DEBT_STATUSES }, type };
  }

  private async getSummary(where: Prisma.DebtWhereInput) {
    const [aggregate, parties] = await Promise.all([
      this.prisma.debt.aggregate({
        where,
        _count: { _all: true },
        _sum: { originalAmount: true, paidAmount: true },
      }),
      this.prisma.debt.groupBy({ where, by: ['partyId'] }),
    ]);
    const original = aggregate._sum.originalAmount ?? new Prisma.Decimal(0);
    const paid = aggregate._sum.paidAmount ?? new Prisma.Decimal(0);

    return {
      count: aggregate._count._all,
      partyCount: parties.length,
      remaining: original.minus(paid),
    };
  }

  private async getQueue(where: Prisma.DebtWhereInput) {
    const debts = await this.prisma.debt.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      take: QUEUE_LIMIT,
      select: {
        id: true,
        code: true,
        type: true,
        title: true,
        originalAmount: true,
        paidAmount: true,
        dueDate: true,
        nextFollowUpAt: true,
        collectionStatus: true,
        party: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    return debts.map((debt) => ({
      ...debt,
      remainingAmount: debt.originalAmount.minus(debt.paidAmount),
    }));
  }
}
