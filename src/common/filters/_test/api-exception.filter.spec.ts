import { describe, expect, it, vi } from 'vitest';
import type { ArgumentsHost } from '@nestjs/common';
import { ApplicationError } from '@common/errors/application-error.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { I18nService } from '@common/i18n/i18n.service.js';
import { ApiExceptionFilter } from '../api-exception.filter.js';

describe('application failures at the HTTP boundary', () => {
  it.each([
    ['invalid', 'parties.ASSIGNEE_NOT_FOUND', 400],
    ['invalid', 'parties.CANNOT_DELETE_ACTIVE_DEBTS', 400],
    ['invalid', 'parties.INVALID_DATE_RANGE', 400],
    ['forbidden', 'errors.FORBIDDEN', 403],
    ['not-found', 'parties.PARTY_NOT_FOUND', 404],
    ['unauthorized', 'auth.INVALID_CREDENTIALS', 401],
    ['conflict', 'debts.INCONSISTENT_PAYMENT_BALANCE', 409],
    ['invalid', 'query.INVALID_FILTER_VALUE', 400, { field: 'fixtureField' }],
  ] as const)(
    'maps %s %s to HTTP %i and preserves both locales',
    (kind, key, statusCode, params?: Record<string, string | number>) => {
      for (const locale of ['en', 'vi'] as const) {
        const i18n = new I18nService();
        const json = vi.fn();
        const status = vi.fn().mockReturnValue({ json });
        const host = {
          switchToHttp: () => ({
            getRequest: () => ({
              headers: { 'accept-language': locale },
              originalUrl: '/api/parties',
            }),
            getResponse: () => ({ status }),
          }),
        } as unknown as ArgumentsHost;
        const failure = new ApplicationError(kind, key, params);
        expect(failure).not.toHaveProperty('getStatus');
        new ApiExceptionFilter(i18n).catch(failure, host);
        expect(status).toHaveBeenCalledWith(statusCode);
        expect(json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            statusCode,
            code: key.split('.').pop(),
            message: i18n.t(key, locale, params),
            path: '/api/parties',
          }),
        );
        expect(i18n.t(key, locale, params)).not.toBe(key);
      }
    },
  );

  it.each([undefined, null, '', ' '])(
    'rejects missing tenant %s without choosing an HTTP status',
    (tenant) => {
      expect(() => requireOrganizationId(tenant as never)).toThrow(ApplicationError);
      try {
        requireOrganizationId(tenant as never);
      } catch (error) {
        expect(error).toMatchObject({ kind: 'forbidden', key: 'errors.FORBIDDEN' });
        expect(error).not.toHaveProperty('getStatus');
      }
    },
  );
});
