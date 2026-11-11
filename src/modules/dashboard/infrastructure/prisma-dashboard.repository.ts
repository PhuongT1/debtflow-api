import { getBusinessDayRange } from '@common/utils/business-date.util.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { PrismaService } from '@database/prisma.service.js';
import { DebtStatus, DebtType, Prisma } from '@generated/prisma/client.js';
import { Injectable } from '@nestjs/common';
import { DashboardQueryDto } from '../dto/query-dashboard.dto.js';
import { getDashboardPeriod } from '../dashboard.query.js';
import { DashboardRepository } from '../repositories/dashboard.repository.js';
import { PrismaDashboardActionCenter } from './prisma-dashboard-action-center.js';

@Injectable()
export class PrismaDashboardRepository extends DashboardRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projection: PrismaDashboardActionCenter,
  ) {
    super();
  }

  async summary(query: DashboardQueryDto, organizationId: string) {
    requireOrganizationId(organizationId);
    const { start, end } = getDashboardPeriod(query);
    const paymentPeriod = start || end ? { gte: start, lte: end } : undefined;
    const [groups, overdueCount, recentPayments, topDebts] = await Promise.all([
      this.prisma.debt.groupBy({
        by: ['type'],
        where: { organizationId, status: { not: DebtStatus.CANCELLED } },
        _sum: { originalAmount: true, paidAmount: true },
      }),
      this.prisma.debt.count({
        where: {
          organizationId,
          status: { in: [DebtStatus.OPEN, DebtStatus.PARTIAL] },
          dueDate: { lt: getBusinessDayRange().start },
        },
      }),
      this.prisma.payment.findMany({
        orderBy: [{ paidAt: 'desc' }, { id: 'asc' }],
        where: { organizationId, ...(paymentPeriod ? { paidAt: paymentPeriod } : {}) },
        take: 8,
        include: { party: true },
      }),
      this.prisma.debt.findMany({
        where: { organizationId, status: { notIn: [DebtStatus.PAID, DebtStatus.CANCELLED] } },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        take: 8,
        include: { party: true },
      }),
    ]);

    const totals = (type: DebtType) => {
      const group = groups.find((group) => group.type === type);
      const original = group?._sum.originalAmount ?? new Prisma.Decimal(0);
      const paid = group?._sum.paidAmount ?? new Prisma.Decimal(0);
      return { original, paid, remaining: original.minus(paid) };
    };

    return {
      receivable: totals(DebtType.RECEIVABLE),
      payable: totals(DebtType.PAYABLE),
      overdueCount,
      recentPayments,
      topDebts,
    };
  }
  actionCenter(query: DashboardQueryDto | undefined, organizationId: string) {
    return this.projection.get(query, organizationId);
  }
}
