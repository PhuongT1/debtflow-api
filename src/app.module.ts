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
import { ProtectedModule } from '@modules/protected/protected.module';
import { PublicModule } from '@modules/public/public.module';

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
    PublicModule,
    ProtectedModule,
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
