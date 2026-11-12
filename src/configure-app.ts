import { INestApplication, RequestMethod } from '@nestjs/common';
import { appConfig, type AppConfig } from '@config/app.config.js';
import { ListQueryAwareValidationPipe } from '@common/query/index.js';
import { createValidationException } from '@common/validation/validation-exception.factory.js';
import { configureSwagger } from '@common/swagger/swagger.setup.js';
import { API_PREFIX } from '@common/constants/api-routes.constants.js';
import { SWAGGER_PATHS } from '@common/swagger/swagger-ui.js';

export function configureApp(app: INestApplication) {
  const config = app.get<AppConfig>(appConfig.KEY);

  app.setGlobalPrefix(API_PREFIX, {
    exclude: Object.values(SWAGGER_PATHS).map((path) => ({
      path: path.slice(1),
      method: RequestMethod.GET,
    })),
  });
  app.enableCors({
    origin: config.server.corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ListQueryAwareValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
      exceptionFactory: createValidationException,
    }),
  );
  return configureSwagger(app);
}
