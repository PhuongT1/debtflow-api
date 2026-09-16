import { Injectable } from '@nestjs/common';
import { DEFAULT_PAGE, MAX_PAGE_SIZE } from '@common/constants/pagination.constants';
import { DebtStatus, Prisma } from '@generated/prisma';
import { DebtsService } from '@modules/protected/debts/debts.service';

@Injectable()
export class ReportsService {
  constructor(private readonly debtsService: DebtsService) {}

  async aging(query: Record<string, string | undefined>, organizationId = 'org_legacy_debtflow') {
    const debts = await this.debtsService.list(organizationId, {
      ...query,
      page: DEFAULT_PAGE,
      pageSize: MAX_PAGE_SIZE,
    });
    const now = new Date();
    const buckets = {
      notDue: { label: 'Chưa đến hạn', amount: new Prisma.Decimal(0), count: 0 },
      day1To7: { label: 'Quá hạn 1-7 ngày', amount: new Prisma.Decimal(0), count: 0 },
      day8To30: { label: 'Quá hạn 8-30 ngày', amount: new Prisma.Decimal(0), count: 0 },
      day31To60: { label: 'Quá hạn 31-60 ngày', amount: new Prisma.Decimal(0), count: 0 },
      day60Plus: { label: 'Quá hạn trên 60 ngày', amount: new Prisma.Decimal(0), count: 0 },
    };

    debts.items
      .filter((debt) => debt.status !== DebtStatus.PAID && debt.status !== DebtStatus.CANCELLED)
      .forEach((debt) => {
        const remaining = debt.originalAmount.minus(debt.paidAmount);
        const lateDays = Math.floor((now.getTime() - debt.dueDate.getTime()) / 86400000);
        const bucket =
          lateDays <= 0
            ? buckets.notDue
            : lateDays <= 7
              ? buckets.day1To7
              : lateDays <= 30
                ? buckets.day8To30
                : lateDays <= 60
                  ? buckets.day31To60
                  : buckets.day60Plus;

        bucket.amount = bucket.amount.plus(remaining);
        bucket.count += 1;
      });

    return buckets;
  }
}
