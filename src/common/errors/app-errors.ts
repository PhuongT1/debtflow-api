import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

type HttpExceptionClass =
  | typeof BadRequestException
  | typeof ConflictException
  | typeof ForbiddenException
  | typeof NotFoundException
  | typeof UnauthorizedException;

/**
 * Builds an HTTP exception whose message is a translation key such as `debts.CANNOT_CANCEL_PAID_DEBT`.
 * ApiExceptionFilter localizes it from the Accept-Language header and exposes the last key segment
 * as the stable machine-readable `code`.
 */
export function appException(
  exception: HttpExceptionClass,
  key: string,
  params?: Record<string, string | number>,
) {
  return new exception({ code: key.split('.').pop(), message: key, ...(params ? { params } : {}) });
}

export const badRequest = (key: string, params?: Record<string, string | number>) =>
  appException(BadRequestException, key, params);
export const unauthorized = (key: string) => appException(UnauthorizedException, key);
export const forbidden = (key: string) => appException(ForbiddenException, key);
export const notFound = (key: string) => appException(NotFoundException, key);
export const conflict = (key: string) => appException(ConflictException, key);
