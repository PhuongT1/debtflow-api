import 'reflect-metadata';
import { Controller, Get, Query, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { ListQuery } from './list-query.decorator';
import { ApiListQuery } from './list-query.swagger';
import { ListQueryAwareValidationPipe } from './list-query.pipe';
import type { ListQueryResult } from './list-query.types';
import { TEST_CONFIG } from './test-config';

@Controller('sort-fixture')
class SortFixtureController {
  @Get()
  @ApiListQuery(TEST_CONFIG)
  list(@Query() query: PaginationQueryDto, @ListQuery(TEST_CONFIG) list: ListQueryResult) {
    return { page: query.page, sort: list.sort, orderBy: list.orderBy };
  }
}
// Vitest's transpiler does not emit decorator type metadata; use the production DTO explicitly.
Reflect.defineMetadata(
  'design:paramtypes',
  [PaginationQueryDto, Object],
  SortFixtureController.prototype,
  'list',
);

describe('single-field list sort HTTP contract', () => {
  let app: INestApplication;
  let origin: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SortFixtureController],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ListQueryAwareValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('accepts one selected field and appends only the internal ID tie-breaker', async () => {
    const response = await fetch(`${origin}/sort-fixture?sortBy=dueDate&sortOrder=desc&page=2`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      page: 2,
      sort: [{ field: 'dueDate', direction: 'desc' }],
      orderBy: [{ dueDate: 'desc' }, { id: 'asc' }],
    });
  });
  it.each([
    'sort=-code',
    'sort=-code&sortBy=code',
    'sortBy=code,amount',
    'sortBy=code&sortBy=amount',
    'sortBy=code&sortOrder=asc&sortOrder=desc',
    'sortBy=code&sortOrder=up',
  ])('rejects removed/multi-field/invalid sorting: %s', async (query) => {
    expect((await fetch(`${origin}/sort-fixture?${query}`)).status).toBe(400);
  });
  it('publishes only sortBy and sortOrder in OpenAPI', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    const parameters = document.paths['/sort-fixture'].get!.parameters!;
    const names = parameters.map((parameter) => ('name' in parameter ? parameter.name : ''));
    expect(names).toContain('sortBy');
    expect(names).toContain('sortOrder');
    expect(names).not.toContain('sort');
  });
});
