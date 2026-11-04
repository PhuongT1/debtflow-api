import { Module } from '@nestjs/common';
import { DebtLineItemService } from './services/debt-line-item.service.js';
import { DebtsController } from './controllers/debts.controller.js';
import { DebtsService } from './services/debts.service.js';
import { PaymentsModule } from '#modules/payments/payments.module.js';
import { PartiesModule } from '#modules/parties/parties.module.js';
import { UsersModule } from '#modules/users/users.module.js';

@Module({
  imports: [PaymentsModule, PartiesModule, UsersModule],
  controllers: [DebtsController],
  providers: [DebtLineItemService, DebtsService],
  exports: [DebtsService],
})
export class DebtsModule {}
