import { Module } from '@nestjs/common';
import { DebtLineItemService } from './services/debt-line-item.service';
import { DebtsController } from './controllers/debts.controller';
import { DebtsService } from './services/debts.service';
import { PaymentsModule } from '@modules/payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [DebtsController],
  providers: [DebtLineItemService, DebtsService],
  exports: [DebtsService],
})
export class DebtsModule {}
