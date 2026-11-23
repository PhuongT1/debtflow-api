import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { parseListQuery, parseListQueryOptions } from './list-query-builder.js';
import type { ListQueryConfig } from './list-query.types.js';

/**
 * Parameter decorator that turns `sortBy`/`sortOrder` and `filter[...]` into a ready-to-use
 * Prisma fragment:
 *
 *   list(@Query() query: QueryDebtsDto, @ListQuery(DEBT_LIST_QUERY) listQuery: ListQueryResult) {}
 */
function listQueryDecorator<T>(
  parse: (raw: Record<string, unknown>, config: ListQueryConfig) => T,
) {
  return createParamDecorator((config: ListQueryConfig, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();
    return parse(request.query as Record<string, unknown>, config);
  });
}

export const ListQuery = listQueryDecorator(parseListQuery);
/** Pass validated criteria to application services that delegate Prisma compilation to their adapter. */
export const ListQueryCriteria = listQueryDecorator(parseListQueryOptions);
