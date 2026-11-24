/**
 * Registers payment HTTP handlers and application services.
 * Binds PaymentsRepository to its Prisma adapter and exports the payment use-case provider.
 */
import { PaymentsRepository } from './application/repositories/payments.repository.js';
import { PrismaPaymentsRepository } from './infrastructure/prisma-payments.repository.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { emitAudit } from '@common/events/audit-event.js';
import { prismaDebtMoneyMath } from '@common/utils/money.util.js';
import { debtPaymentState } from '@modules/debts/public/debt-payment.js';
import { Module } from '@nestjs/common';
import { PaymentsController } from './presentation/payments.controller.js';
import { PaymentsService } from './application/payments.service.js';

@Module({
  controllers: [PaymentsController],
  providers: [
    { provide: PaymentsRepository, useClass: PrismaPaymentsRepository },
    {
      provide: PaymentsService,
      inject: [PaymentsRepository, EventEmitter2],
      useFactory: (repository: PaymentsRepository, events: EventEmitter2) =>
        new PaymentsService(
          repository,
          (entry) => emitAudit(events, entry),
          prismaDebtMoneyMath,
          debtPaymentState,
        ),
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
