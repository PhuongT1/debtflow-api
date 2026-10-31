# Validation And Errors

Global validation is configured in:

```txt
src/configure-app.ts
```

Important options:

```ts
whitelist: true;
forbidNonWhitelisted: true;
transform: true;
```

Unknown request fields are rejected instead of silently ignored.

## Validation Error Shape

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ.",
  "errors": [
    {
      "field": "email",
      "message": "Vui lòng nhập email.",
      "code": "AUTH_EMAIL_REQUIRED"
    }
  ],
  "timestamp": "2026-08-18T08:30:00.000Z",
  "path": "/api/auth/login"
}
```

## Frontend Mapping

The frontend can map field errors like this:

```ts
const apiError = error.response.data;
const fieldErrors = Object.fromEntries(
  (apiError.errors ?? []).map((item) => [item.field, item.message]),
);
```

## Prisma Errors

Prisma known errors are handled by:

```txt
src/common/filters/api-exception.filter.ts
```

The same global filter also handles NestJS HTTP exceptions and unexpected server errors. See
[API Response Format](api-response-format.md) for the complete success and error contracts.
