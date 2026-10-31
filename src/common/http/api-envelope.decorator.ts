import { applyDecorators, HttpStatus, type Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiErrorResponseDto, PaginationMetaDto } from './api-envelope.dto';

type EnvelopeOptions = {
  /** HTTP status, 200 by default. */
  status?: HttpStatus;
  /** `data` is an array of `model` and `meta.pagination` is present. */
  paginated?: boolean;
  /** `data` is an array of `model` without pagination. */
  isArray?: boolean;
  description?: string;
};

/**
 * Documents a success response wrapped in the standard envelope
 * `{ success, statusCode, code, message, data, meta?, timestamp, path }`.
 */
export function ApiEnvelope(model: Type<unknown>, options: EnvelopeOptions = {}) {
  const status = options.status ?? HttpStatus.OK;
  const isList = options.paginated || options.isArray;
  const data = isList
    ? { type: 'array', items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

  return applyDecorators(
    ApiExtraModels(model, PaginationMetaDto),
    ApiResponse({
      status,
      description: options.description ?? 'Success.',
      schema: {
        type: 'object',
        required: ['success', 'statusCode', 'code', 'message', 'data', 'timestamp', 'path'],
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: status },
          code: {
            type: 'string',
            example: status === HttpStatus.CREATED ? 'RESOURCE_CREATED' : 'SUCCESS',
          },
          message: { type: 'string', example: 'Request completed successfully.' },
          data,
          ...(options.paginated
            ? {
                meta: {
                  type: 'object',
                  properties: { pagination: { $ref: getSchemaPath(PaginationMetaDto) } },
                },
              }
            : {}),
          timestamp: { type: 'string', format: 'date-time' },
          path: { type: 'string', example: '/api/resource' },
        },
      },
    }),
  );
}

type ErrorOptions = { badRequest?: string; notFound?: string; conflict?: string };

/** Documents the error envelope for the statuses an endpoint can return besides 401/403. */
export function ApiErrorEnvelopes(options: ErrorOptions) {
  const decorators = [ApiExtraModels(ApiErrorResponseDto)];
  const type = ApiErrorResponseDto;

  if (options.badRequest) {
    decorators.push(ApiBadRequestResponse({ description: options.badRequest, type }));
  }
  if (options.notFound) {
    decorators.push(ApiNotFoundResponse({ description: options.notFound, type }));
  }
  if (options.conflict) {
    decorators.push(ApiConflictResponse({ description: options.conflict, type }));
  }

  return applyDecorators(...decorators);
}
