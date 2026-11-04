import type { PaginationMetaDto, ApiErrorDetailDto, ApiErrorResponseDto } from './api-envelope.dto.js';

export type PaginationMeta = PaginationMetaDto;
export type ApiErrorDetail = ApiErrorDetailDto;
export type ApiErrorResponse = ApiErrorResponseDto;

export type ApiSuccessResponse<T> = {
  success: true;
  statusCode: number;
  code: string;
  message: string;
  data: T;
  meta?: {
    pagination: PaginationMeta;
  };
  timestamp: string;
  path: string;
};
