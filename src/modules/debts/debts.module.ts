/**
 * Registers debt HTTP handlers, application services and line-item rules.
 * Binds DebtsRepository to its Prisma adapter and exports intended debt providers.
 */
import { DebtsRepository } from './application/repositories/debts.repository.js';
import { PrismaDebtsRepository } from './infrastructure/prisma-debts.repository.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { emitAudit } from '@common/events/audit-event.js';
import { prismaDebtMoneyMath } from '@common/utils/money.util.js';
import { Module } from '@nestjs/common';
import { DebtLineItemService } from './application/debt-line-item.service.js';
import { DebtsController } from './presentation/debts.controller.js';
import { DebtsService } from './application/debts.service.js';
import { PaymentsModule } from '@modules/payments/payments.module.js';

@Module({
  imports: [PaymentsModule],
  controllers: [DebtsController],
  providers: [
    {
      provide: DebtLineItemService,
      useFactory: () => new DebtLineItemService(prismaDebtMoneyMath),
    },
    {
      provide: DebtsService,
      inject: [DebtsRepository, DebtLineItemService, EventEmitter2],
      useFactory: (
        repository: DebtsRepository,
        items: DebtLineItemService,
        events: EventEmitter2,
      ) =>
        new DebtsService(
          repository,
          items,
          (entry) => emitAudit(events, entry),
          prismaDebtMoneyMath,
        ),
    },
    { provide: DebtsRepository, useClass: PrismaDebtsRepository },
  ],
  exports: [DebtsService],
})
export class DebtsModule {}
