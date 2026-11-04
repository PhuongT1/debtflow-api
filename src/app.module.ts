import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from '@auth/auth.module.js';
import { ApiExceptionFilter } from '@common/filters/api-exception.filter.js';
import { I18nModule } from '@common/i18n/i18n.module.js';
import { ApiResponseInterceptor } from '@common/interceptors/api-response.interceptor.js';
import { validateEnv } from '@config/env.validation.js';
import { DatabaseModule } from '@database/database.module.js';
import { AuditLogsModule } from '@modules/audit-logs/audit-logs.module.js';
import { AuthApiModule } from '@modules/auth/auth.module.js';
import { CatalogModule } from '@modules/catalog/catalog.module.js';
import { DashboardModule } from '@modules/dashboard/dashboard.module.js';
import { DebtsModule } from '@modules/debts/debts.module.js';
import { ExportsModule } from '@modules/exports/exports.module.js';
import { ImportsModule } from '@modules/imports/imports.module.js';
import { PartiesModule } from '@modules/parties/parties.module.js';
import { PaymentsModule } from '@modules/payments/payments.module.js';
import { ReportsModule } from '@modules/reports/reports.module.js';
import { UsersModule } from '@modules/users/users.module.js';

const nodeEnv = process.env.NODE_ENV ?? 'development';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${nodeEnv}`, '.env'],
      validate: validateEnv,
    }),
    EventEmitterModule.forRoot(),
    I18nModule,
    DatabaseModule,
    AuthModule,
    AuthApiModule,
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
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule {}
