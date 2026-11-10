/**
 * Registers debt HTTP handlers, application services and line-item rules.
 * Binds DebtsRepository to its Prisma adapter and exports intended debt providers.
 */
import { DebtsRepository } from './repositories/debts.repository.js';
import { PrismaDebtsRepository } from './infrastructure/prisma-debts.repository.js';
import { Module } from '@nestjs/common';
import { DebtLineItemService } from './services/debt-line-item.service.js';
import { DebtsController } from './debts.controller.js';
import { DebtsService } from './services/debts.service.js';
import { PaymentsModule } from '@modules/payments/payments.module.js';

@Module({
  imports: [PaymentsModule],
  controllers: [DebtsController],
  providers: [
    DebtLineItemService,
    DebtsService,
    { provide: DebtsRepository, useClass: PrismaDebtsRepository },
  ],
  exports: [DebtsService],
})
export class DebtsModule {}
