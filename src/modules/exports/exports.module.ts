import { Module } from '@nestjs/common';
import { ExportsController } from './controllers/exports.controller';
import { DebtsModule } from '@modules/debts/debts.module';
import { DebtExportService } from './services/debt-export.service';

@Module({
  imports: [DebtsModule],
  controllers: [ExportsController],
  providers: [DebtExportService],
})
export class ExportsModule {}
