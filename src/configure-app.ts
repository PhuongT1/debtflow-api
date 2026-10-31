import { INestApplication, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ListQueryAwareValidationPipe } from '@common/query';
import { createValidationException } from '@common/validation/validation-exception.factory';

export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'docs', method: RequestMethod.GET },
      { path: 'docs-json', method: RequestMethod.GET },
    ],
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
  const document = createOpenApiDocument(app);
  const httpAdapter = app.getHttpAdapter();

  httpAdapter.get('/docs-json', (_request, response) => {
    response.json(document);
  });

  httpAdapter.get('/docs', (_request, response) => {
    response.type('html').send(renderSwaggerHtml());
  });
}

export function createOpenApiDocument(app: INestApplication) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sales Debt Management API')
    .setDescription(
      'Standalone backend API for sales debt management. Successful responses are wrapped in ' +
        'a `{ success, statusCode, code, message, data, meta?, timestamp, path }` envelope; see docs/guides/api-response-format.md.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addGlobalParameters({
      name: 'Accept-Language',
      in: 'header',
      required: false,
      description: 'Response language for messages and errors. Defaults to vi.',
      schema: { type: 'string', enum: ['vi', 'en'], default: 'vi' },
    })
    .build();

  return SwaggerModule.createDocument(app, swaggerConfig);
}

function renderSwaggerHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Swagger UI - Sales Debt Management API</title>
    <link rel="icon" href="https://unpkg.com/swagger-ui-dist@5.17.14/favicon-32x32.png" />
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: "/docs-json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: "StandaloneLayout"
        });
      };
    </script>
  </body>
</html>`;
}
