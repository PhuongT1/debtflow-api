/**
 * Registers payment HTTP handlers and application services.
 * Binds PaymentsRepository to its Prisma adapter and exports the payment use-case provider.
 */
import { PaymentsRepository } from './repositories/payments.repository.js';
import { PrismaPaymentsRepository } from './infrastructure/prisma-payments.repository.js';
import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, { provide: PaymentsRepository, useClass: PrismaPaymentsRepository }],
  exports: [PaymentsService],
})
export class PaymentsModule {}
