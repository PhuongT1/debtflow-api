# API And Swagger

## Local URLs

Open these after starting the backend:

```txt
API base URL:  http://localhost:4000/api
Swagger UI:    http://localhost:4000/docs
OpenAPI JSON:  http://localhost:4000/docs-json
```

Swagger is configured in:

```txt
src/configure-app.ts
```

## Auth

Login endpoint:

```txt
POST /api/auth/login
```

Request body:

```json
{
  "email": "admin@debtflow.local",
  "password": "Admin@123456"
}
```

Protected endpoints use:

```txt
Authorization: Bearer <accessToken>
```

## Frontend API URL

The frontend `.env` should use:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```
