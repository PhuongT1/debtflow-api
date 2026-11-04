import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'node:path';
import { API_TAGS } from '../constants/api-tags.constants.js';
import { renderSwaggerHtml, SWAGGER_PATHS } from './swagger-ui.js';

/** Register the documentation adapter and return the same document for offline generation. */
export function configureSwagger(app: INestApplication) {
  const document = createOpenApiDocument(app);
  const adapter = app.getHttpAdapter();
  adapter.get(SWAGGER_PATHS.json, (_request, response) => response.json(document));
  adapter.get(SWAGGER_PATHS.ui, (_request, response) =>
    response.type('html').send(renderSwaggerHtml()),
  );
  adapter.get(SWAGGER_PATHS.authScript, (_request, response) => {
    response.type('application/javascript').sendFile(join(import.meta.dirname, 'swagger-auth.js'));
  });
  return document;
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
    });
  for (const tag of Object.values(API_TAGS)) swaggerConfig.addTag(tag);

  return SwaggerModule.createDocument(app, swaggerConfig.build());
}
