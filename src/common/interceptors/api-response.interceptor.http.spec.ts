import 'reflect-metadata';
import { Controller, Get, HttpCode, Res, type INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SkipApiResponse } from '../decorators/api-response.decorator.js';
import { I18nService } from '../i18n/i18n.service.js';
import { ApiResponseInterceptor } from './api-response.interceptor.js';

const binary = Buffer.from([0x50, 0x4b, 0x00, 0xff]);

// Test-only routes exercise Nest/Express transport behavior; no application or database is imported.
@Controller('response-fixture')
class ResponseFixtureController {
  @Get('empty')
  @HttpCode(204)
  empty() {
    return { mustNotBeSent: true };
  }

  @Get('download')
  @SkipApiResponse()
  download(@Res() response: Response) {
    response.type('application/octet-stream');
    response.send(binary);
  }

  @Get('page')
  page() {
    return { items: [{ id: 'party-3' }], page: 2, pageSize: 2, total: 3 };
  }
}

describe('ApiResponseInterceptor Nest HTTP transport', () => {
  let app: INestApplication | undefined;
  let origin: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ResponseFixtureController],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useFactory: () => new ApiResponseInterceptor<unknown>(new Reflector(), new I18nService()),
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('sends a truly empty HTTP 204 response even when the controller returns data', async () => {
    const response = await fetch(`${origin}/api/response-fixture/empty`);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('preserves the binary content type and exact bytes sent through @Res with skip metadata', async () => {
    const response = await fetch(`${origin}/api/response-fixture/download`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(binary);
  });

  it('serializes paginated data and navigation through the global interceptor', async () => {
    const response = await fetch(`${origin}/api/response-fixture/page`, {
      headers: { 'Accept-Language': 'en' },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      statusCode: 200,
      code: 'SUCCESS',
      message: 'Request completed successfully.',
      data: [{ id: 'party-3' }],
      meta: {
        pagination: {
          page: 2,
          pageSize: 2,
          total: 3,
          totalPages: 2,
          hasNextPage: false,
          hasPreviousPage: true,
        },
      },
      path: '/api/response-fixture/page',
    });
  });
});
