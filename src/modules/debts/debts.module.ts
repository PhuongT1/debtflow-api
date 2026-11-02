import { Module } from '@nestjs/common';
import { DebtLineItemService } from './services/debt-line-item.service';
import { DebtsController } from './controllers/debts.controller';
import { DebtsService } from './services/debts.service';
import { PaymentsModule } from '@modules/payments/payments.module';
import { PartiesModule } from '@modules/parties/parties.module';
import { UsersModule } from '@modules/users/users.module';

@Module({
  imports: [PaymentsModule, PartiesModule, UsersModule],
  controllers: [DebtsController],
  providers: [DebtLineItemService, DebtsService],
  exports: [DebtsService],
})
export class DebtsModule {}
