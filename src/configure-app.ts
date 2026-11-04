import { INestApplication, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListQueryAwareValidationPipe } from '@common/query';
import { createValidationException } from '@common/validation/validation-exception.factory';
import { configureSwagger } from '@common/swagger/swagger.setup';
import { SWAGGER_PATHS } from '@common/swagger/swagger-ui';

export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api', {
    exclude: Object.values(SWAGGER_PATHS).map((path) => ({
      path: path.slice(1),
      method: RequestMethod.GET,
    })),
  });
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN')?.split(',') ?? ['http://localhost:3000'],
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
