/** Documentation models of the standard envelope. The runtime types live in `api-response.types.ts`. */

export class ApiErrorDetailDto {
  /** Name of the invalid input field. */
  field?: string;
  /** Stable machine-readable code. */
  code!: string;
  /** Localized message (see the `Accept-Language` header). */
  message!: string;
}

export class ApiErrorResponseDto {
  /** @example false */
  success!: false;
  /** @example 400 */
  statusCode!: number;
  /** Stable machine-readable code. Switch on this, display `message`. @example "VALIDATION_ERROR" */
  code!: string;
  /** Localized message. */
  message!: string;
  /** Field-level details, present for validation errors. */
  errors?: ApiErrorDetailDto[];
  /** @example "2026-10-30T10:00:00.000Z" */
  timestamp!: string;
  /** @example "/api/parties" */
  path!: string;
}

export class PaginationMetaDto {
  /** @example 1 */
  page!: number;
  /** @example 20 */
  pageSize!: number;
  /** @example 42 */
  total!: number;
  /** @example 3 */
  totalPages!: number;
  hasNextPage!: boolean;
  hasPreviousPage!: boolean;
}
