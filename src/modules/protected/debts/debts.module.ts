import { Module } from '@nestjs/common';
import { DebtLineItemService } from './debt-line-item.service';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { PaymentsModule } from '@modules/protected/payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [DebtsController],
  providers: [DebtLineItemService, DebtsService],
  exports: [DebtsService],
})
export class DebtsModule {}
