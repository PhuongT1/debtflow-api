import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from '@auth/auth.module';
import { ApiExceptionFilter } from '@common/filters/api-exception.filter';
import { I18nModule } from '@common/i18n/i18n.module';
import { ApiResponseInterceptor } from '@common/interceptors/api-response.interceptor';
import { validateEnv } from '@config/env.validation';
import { DatabaseModule } from '@database/database.module';
import { AuditLogsModule } from '@modules/audit-logs/audit-logs.module';
import { AuthApiModule } from '@modules/auth/auth.module';
import { CatalogModule } from '@modules/catalog/catalog.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { DebtsModule } from '@modules/debts/debts.module';
import { ExportsModule } from '@modules/exports/exports.module';
import { ImportsModule } from '@modules/imports/imports.module';
import { PartiesModule } from '@modules/parties/parties.module';
import { PaymentsModule } from '@modules/payments/payments.module';
import { ReportsModule } from '@modules/reports/reports.module';
import { UsersModule } from '@modules/users/users.module';

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
