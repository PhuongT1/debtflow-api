import 'reflect-metadata';
import { HttpStatus, SetMetadata, type ExecutionContext, type Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { defer, lastValueFrom, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SKIP_API_RESPONSE_KEY, SkipApiResponse } from '../../decorators/api-response.decorator.js';
import { I18nService } from '../../i18n/i18n.service.js';
import { ApiResponseInterceptor } from '../api-response.interceptor.js';

class WrappedController {
  result() {}

  @SkipApiResponse()
  rawResult() {}
}

@SkipApiResponse()
class RawController {
  result() {}

  @SetMetadata(SKIP_API_RESPONSE_KEY, false)
  wrappedResult() {}
}

const now = new Date('2026-11-02T05:00:00Z');

function setup<T>(
  value: T,
  {
    status = HttpStatus.OK,
    locale = 'en',
    controller = WrappedController,
    handler = WrappedController.prototype.result,
  }: { status?: number; locale?: string; controller?: Type<unknown>; handler?: () => void } = {},
) {
  const request = { originalUrl: '/api/parties?page=2', headers: { 'accept-language': locale } };
  const response = { statusCode: status };
  const context = {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  const next = { handle: vi.fn(() => of(value)) };
  const interceptor = new ApiResponseInterceptor<T>(new Reflector(), new I18nService());
  const run = () => lastValueFrom(interceptor.intercept(context, next));
  return { interceptor, context, next, response, run };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

describe('ApiResponseInterceptor JSON contract', () => {
  it('wraps data once with the actual status, path, timestamp and English message', async () => {
    const data = { id: 'party-1' };
    const s = setup(data);
    expect(await s.run()).toEqual({
      success: true,
      statusCode: 200,
      code: 'SUCCESS',
      message: 'Request completed successfully.',
      data,
      timestamp: now.toISOString(),
      path: '/api/parties?page=2',
    });
    expect(s.next.handle).toHaveBeenCalledOnce();
  });

  it.each([
    ['en', 'Resource created successfully.'],
    ['vi', 'Tạo mới dữ liệu thành công.'],
  ])('uses the localized create contract for %s', async (locale, message) => {
    const s = setup({ id: 'party-1' }, { status: HttpStatus.CREATED, locale });
    expect(await s.run()).toMatchObject({ statusCode: 201, code: 'RESOURCE_CREATED', message });
  });

  it('resolves Vietnamese as the default locale when the header is unsupported', async () => {
    const s = setup({}, { locale: 'unsupported' });
    expect(await s.run()).toMatchObject({ message: 'Yêu cầu đã được thực hiện thành công.' });
  });

  it.each([null, undefined, false, 0, ''])(
    'preserves falsy data semantics for %s',
    async (value) => {
      expect(await setup(value).run()).toMatchObject({ data: value ?? null });
    },
  );

  it('does not mistake an ordinary object with an items field for pagination', async () => {
    const data = { items: ['a'], total: 1 };
    expect(await setup(data).run()).toMatchObject({ data });
    expect(await setup(data).run()).not.toHaveProperty('meta');
  });

  it('uses the status set by the handler before its result is emitted', async () => {
    const s = setup({ id: 'party-1' });
    const next = {
      handle: () =>
        defer(() => {
          s.response.statusCode = HttpStatus.CREATED;
          return of({ id: 'party-1' });
        }),
    };
    expect(await lastValueFrom(s.interceptor.intercept(s.context, next))).toMatchObject({
      statusCode: 201,
      code: 'RESOURCE_CREATED',
    });
  });

  it('propagates handler errors to exception handling instead of creating a success envelope', async () => {
    const s = setup({});
    const error = new Error('controlled failure');
    await expect(
      lastValueFrom(s.interceptor.intercept(s.context, { handle: () => throwError(() => error) })),
    ).rejects.toBe(error);
  });
});

describe('ApiResponseInterceptor pagination', () => {
  it.each([
    { page: 1, pageSize: 20, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
    { page: 1, pageSize: 20, total: 21, totalPages: 2, hasNextPage: true, hasPreviousPage: false },
    { page: 2, pageSize: 20, total: 21, totalPages: 2, hasNextPage: false, hasPreviousPage: true },
    { page: 2, pageSize: 20, total: 40, totalPages: 2, hasNextPage: false, hasPreviousPage: true },
    { page: 3, pageSize: 20, total: 21, totalPages: 2, hasNextPage: false, hasPreviousPage: true },
  ])('reports correct navigation for page $page of $total items', async (expected) => {
    const { page, pageSize, total } = expected;
    const items = total === 0 || page > expected.totalPages ? [] : [{ id: 'party-1' }];
    const result = await setup({ items, page, pageSize, total }).run();
    expect(result).toMatchObject({ data: items, meta: { pagination: expected } });
    expect(result).not.toHaveProperty('data.items');
  });
});

describe('ApiResponseInterceptor empty and raw responses', () => {
  it.each([{}, { items: [], total: 0, page: 1, pageSize: 20 }])(
    'emits no envelope for HTTP 204 even when the handler returns %j',
    async (data) => {
      expect(await setup(data, { status: HttpStatus.NO_CONTENT }).run()).toBeUndefined();
    },
  );

  it.each([
    { controller: RawController, handler: RawController.prototype.result },
    { controller: WrappedController, handler: WrappedController.prototype.rawResult },
  ])(
    'keeps binary bytes untouched when skip metadata is on class or handler: %j',
    async (metadata) => {
      const bytes = Buffer.from([0x50, 0x4b, 0x00, 0xff]);
      const s = setup(bytes, metadata);
      expect(await s.run()).toBe(bytes);
      expect(s.next.handle).toHaveBeenCalledOnce();
    },
  );

  it('keeps the raw response object untouched rather than only supporting binary buffers', async () => {
    const raw = { external: true };
    expect(
      await setup(raw, {
        controller: RawController,
        handler: RawController.prototype.result,
      }).run(),
    ).toBe(raw);
  });

  it('lets handler skip=false override class skip=true', async () => {
    const s = setup(
      { id: 'party-1' },
      { controller: RawController, handler: RawController.prototype.wrappedResult },
    );
    expect(await s.run()).toMatchObject({ success: true, data: { id: 'party-1' } });
  });

  it('preserves the raw undefined result used by a controller that already sent its response', async () => {
    expect(
      await setup(undefined, {
        controller: RawController,
        handler: RawController.prototype.result,
      }).run(),
    ).toBeUndefined();
  });
});
