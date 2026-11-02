import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { parseListQuery } from './list-query-builder';
import type { ListQueryConfig } from './list-query.types';

/**
 * Parameter decorator that turns `sort`/`sortBy`/`sortOrder` and `filter[...]` into a ready-to-use
 * Prisma fragment:
 *
 *   list(@Query() query: QueryDebtsDto, @ListQuery(DEBT_LIST_QUERY) listQuery: ListQueryResult) {}
 */
export const ListQuery = createParamDecorator(
  (config: ListQueryConfig, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();

    return parseListQuery(request.query as Record<string, unknown>, config);
  },
);
