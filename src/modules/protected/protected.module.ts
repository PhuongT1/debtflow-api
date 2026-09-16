import { Module } from '@nestjs/common';
import { AccountModule } from './account/account.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { CatalogModule } from './catalog/catalog.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DebtsModule } from './debts/debts.module';
import { ExportsModule } from './exports/exports.module';
import { ImportsModule } from './imports/imports.module';
import { PartiesModule } from './parties/parties.module';
import { PaymentsModule } from './payments/payments.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AccountModule,
    UsersModule,
    PartiesModule,
    CatalogModule,
    DebtsModule,
    PaymentsModule,
    DashboardModule,
    ReportsModule,
    ExportsModule,
    ImportsModule,
    AuditLogsModule,
  ],
})
export class ProtectedModule {}
