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
  "email": "owner@anphu-fashion.demo",
  "password": "Demo@123456"
}
```

These credentials are the demo owner created by `npm run db:seed` and are the default Swagger login
example. `organizationId` is optional: omit the field to select the earliest created ACTIVE membership
whose organization is ACTIVE, even when the account has multiple memberships. Set it to a real
organization ID only when you want to choose a specific workspace. Sending the placeholder
`"organizationId": "string"` attempts to find that exact organization and fails with
`NO_ACTIVE_ORGANIZATION`; it is not an automatic-selection value.

After login, protected endpoints get the organization context from the access token. To change it,
use `POST /api/auth/switch-organization` with a real organization ID from your account's memberships.

Protected endpoints use:

```txt
Authorization: Bearer <accessToken>
```

### Automatic and manual Swagger authorization

- Execute login in Swagger: a successful response fills the editable **Access token** field above
  the API documentation and authorizes protected requests automatically.
- Refresh and switch-organization responses also replace the applied token.
- To use a token from elsewhere, paste it into **Access token**, edit if needed, and click **Apply**.
  Both a raw token and a token prefixed with `Bearer ` are accepted. **Show token** reveals the value.
- **Clear** removes the applied token. The standard **Authorize** dialog remains available and stays
  synchronized with the editable field, including its **Logout** action.
- The applied access token survives reloads through `sessionStorage` in the current tab. It is not
  written to `localStorage`; passwords and refresh tokens are not stored by this helper. Closing the
  tab normally ends its session; browser session restoration can restore session storage as well.
- An expired JWT is not restored on page load. Login or refresh must be executed explicitly when
  needed; Swagger does not refresh in the background. **Clear** removes only Swagger's local
  authorization and does not revoke an issued token on the server.

The helper uses Swagger UI's
[response interceptor and preauthorization API](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/)
and a [plugin](https://swagger.io/docs/open-source-tools/swagger-ui/customization/plugin-api/) to synchronize manual authorization.
Only successful responses from the same origin's three auth endpoints may automatically replace the token.

## Frontend API URL

The frontend `.env` should use:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```
