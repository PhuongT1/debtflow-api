# API Response Format

All normal JSON endpoints use one response envelope. Controllers and services return business
data; the global response interceptor creates the HTTP envelope.

## Successful Response

```json
{
  "success": true,
  "statusCode": 200,
  "code": "SUCCESS",
  "message": "Request completed successfully.",
  "data": {},
  "timestamp": "2026-08-18T08:30:00.000Z",
  "path": "/api/parties/party-id"
}
```

`POST` endpoints use HTTP `201` by default:

```json
{
  "success": true,
  "statusCode": 201,
  "code": "RESOURCE_CREATED",
  "message": "Resource created successfully.",
  "data": {},
  "timestamp": "2026-08-18T08:30:00.000Z",
  "path": "/api/parties"
}
```

The HTTP status code remains authoritative. `statusCode` is included in the body so clients that
store or forward responses still have the request outcome.

## Paginated Response

List endpoints move pagination information into `meta.pagination` and put only records in `data`:

```json
{
  "success": true,
  "statusCode": 200,
  "code": "SUCCESS",
  "message": "Request completed successfully.",
  "data": [],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 42,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  },
  "timestamp": "2026-08-18T08:30:00.000Z",
  "path": "/api/parties?page=1&pageSize=20"
}
```

Frontend usage:

```ts
const parties = response.data.data;
const pagination = response.data.meta.pagination;
```

The first `data` above is the HTTP client's response body property, while the second is the API
envelope's `data` field. A configured API client can unwrap the envelope once globally.

## Error Response

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ.",
  "errors": [
    {
      "field": "email",
      "code": "AUTH_EMAIL_REQUIRED",
      "message": "Vui lòng nhập email."
    }
  ],
  "timestamp": "2026-08-18T08:30:00.000Z",
  "path": "/api/auth/login"
}
```

Frontend code should branch on the HTTP status or `success`, then use `code` for program logic and
`message` for display. Do not parse human-readable messages to determine behavior.

## Implementation

```txt
src/common/interceptors/api-response.interceptor.ts
src/common/filters/api-exception.filter.ts
src/common/http/api-response.types.ts
```

- `ApiResponseInterceptor` wraps successful controller results.
- `ApiExceptionFilter` normalizes validation, authentication, domain, Prisma, and unexpected
  errors.
- Paginated service results are recognized centrally and converted to `data` plus
  `meta.pagination`.
- Excel downloads use `@SkipApiResponse()` because binary responses must not be JSON-wrapped.
- Swagger HTML and OpenAPI JSON are registered directly on the HTTP adapter and are not wrapped.

Controllers should not manually construct this envelope. Return application data normally and let
the global interceptor and exception filter apply the standard format.
