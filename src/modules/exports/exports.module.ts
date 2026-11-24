/**
 * Registers the debt export HTTP handler and spreadsheet-generation service.
 * Imports debt providers through their owning Nest module.
 */
import { Module } from '@nestjs/common';
import { ExportsController } from './presentation/exports.controller.js';
import { DebtsModule } from '@modules/debts/debts.module.js';
import { XlsxDebtExportAdapter } from './infrastructure/xlsx-debt-export.adapter.js';
import { DebtExportService } from './application/debt-export.service.js';

@Module({
  imports: [DebtsModule],
  controllers: [ExportsController],
  providers: [
    XlsxDebtExportAdapter,
    {
      provide: DebtExportService,
      inject: [XlsxDebtExportAdapter],
      useFactory: (adapter: XlsxDebtExportAdapter) => new DebtExportService(adapter),
    },
  ],
})
export class ExportsModule {}
