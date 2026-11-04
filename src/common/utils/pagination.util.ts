import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@common/constants/pagination.constants.js';

type PaginationInput = {
  page?: number;
  pageSize?: number;
};

export type Pagination = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export function getPagination(input: PaginationInput): Pagination {
  const page = input.page ?? DEFAULT_PAGE;
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function paginate<T>(items: T[], total: number, pagination: Pagination): PaginatedResult<T> {
  return {
    items,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

export function isPaginatedResult(value: unknown): value is PaginatedResult<unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as Partial<PaginatedResult<unknown>>;

  return (
    Array.isArray(result.items) &&
    typeof result.total === 'number' &&
    typeof result.page === 'number' &&
    typeof result.pageSize === 'number'
  );
}
