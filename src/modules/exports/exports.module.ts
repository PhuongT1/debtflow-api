import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller.js';
import { DebtsModule } from '@modules/debts/debts.module.js';
import { DebtExportService } from './debt-export.service.js';

@Module({
  imports: [DebtsModule],
  controllers: [ExportsController],
  providers: [DebtExportService],
})
export class ExportsModule {}
