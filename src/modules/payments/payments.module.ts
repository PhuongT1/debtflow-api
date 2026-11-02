import { Module } from '@nestjs/common';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentsService } from './services/payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
