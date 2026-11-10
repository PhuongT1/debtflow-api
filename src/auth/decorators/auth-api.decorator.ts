/**
 * Composes auth route annotations: PublicApi sets runtime public-access metadata.
 * ProtectedApi documents Swagger auth/errors; global guards enforce the actual access checks.
 */
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Public } from './public.decorator.js';

export const PublicApi = () => applyDecorators(Public());

export const ProtectedApi = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Thiếu token hoặc token không hợp lệ.' }),
    ApiForbiddenResponse({ description: 'Tài khoản không có quyền thực hiện thao tác này.' }),
  );
