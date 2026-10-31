import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { isListQueryKey } from './parse-filter-params';

/**
 * ValidationPipe that ignores the list-query keys (`sort`, `sortBy`, `sortOrder`, `filterOperator`,
 * `filter[...]`) when validating query DTOs: they are dynamic, so they are validated against the
 * per-resource allow-list by `@ListQuery` instead.
 */
export class ListQueryAwareValidationPipe extends ValidationPipe {
  async transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type === 'query' && value && typeof value === 'object') {
      value = Object.fromEntries(Object.entries(value).filter(([key]) => !isListQueryKey(key)));
    }

    return super.transform(value, metadata);
  }
}
