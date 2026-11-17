import { Logger } from '@nestjs/common';
import { SWAGGER_PATHS } from '@common/swagger/swagger-ui.js';
import { appConfig, type AppConfig } from '@config/app.config.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<AppConfig>(appConfig.KEY);

  app.enableShutdownHooks();
  configureApp(app);
  await app.listen(config.server.port);
  Logger.log(`Swagger UI: ${new URL(SWAGGER_PATHS.ui, await app.getUrl()).href}`, 'Bootstrap');
}

bootstrap();
