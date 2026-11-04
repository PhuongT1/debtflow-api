import { Module } from '@nestjs/common';
import { ExportsController } from './controllers/exports.controller.js';
import { DebtsModule } from '@modules/debts/debts.module.js';
import { DebtExportService } from './services/debt-export.service.js';

@Module({
  imports: [DebtsModule],
  controllers: [ExportsController],
  providers: [DebtExportService],
})
export class ExportsModule {}
