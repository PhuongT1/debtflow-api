# API And Swagger

## Local URLs

Open these after starting the backend:

```txt
API base URL:  http://localhost:4000/api
Swagger UI:    http://localhost:4000/docs
OpenAPI JSON:  http://localhost:4000/docs-json
```

## Where to make changes

`configureApp()` calls `configureSwagger()` and returns its OpenAPI document. The live `/docs-json`
route and `scripts/generate-api-docs.ts` use that same document; do not maintain a handwritten API spec.

| Change                                                                                | Edit this owner                                                                                    |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Endpoint, input/output or response description                                        | Owning feature controller and DTO; shared response decorators in `common/decorators/`              |
| Exposed sort/filter fields                                                            | Feature `*.list-query.ts`; shared `common/query/list-query.swagger.ts` renders their documentation |
| API title, version, bearer scheme, global headers or documentation route registration | `src/common/swagger/swagger.setup.ts`                                                              |
| Documentation URLs, page HTML or pinned Swagger UI asset version                      | `src/common/swagger/swagger-ui.ts`                                                                 |
| Automatic login token, persistence, expiry and Logout                                 | `src/common/swagger/swagger-auth.js`; extend adjacent `swagger-auth.spec.ts`                       |
| Application prefix, CORS and global validation                                        | `src/configure-app.ts`                                                                             |
| Generated Markdown rendering                                                          | `scripts/generate-api-docs.ts`; schema still comes from the shared Swagger setup                   |

The browser entry is ordinary JavaScript served at `/docs/swagger-auth.js`. It has no Node imports,
backend providers or business logic. `npm run lint` checks TypeScript and this browser JavaScript,
including unknown browser globals; the auth suite executes the actual asset. Keep browser helpers
with this entry rather than creating parallel Swagger pages, token forms or feature-specific scripts.

Nest copies the asset to `dist/src/common/swagger/` through `nest-cli.json`, including asset watching
in development. Vercel already includes `dist/**`. Keep the asset rule when changing the build layout.
The compiled application HTTP suite verifies that the page, JSON document and browser asset are served.

After changing controller/DTO documentation, run `npm run docs:generate`. After changing the browser
helper, run its adjacent tests, `npm run typecheck` and `npm run lint`. `npm run build` must finish before running the full
suite, which loads compiled Nest metadata and checks packaged assets; `npm run check` uses this order.
For documentation-site changes run `npm run docs:build`. Keep generated references with their source.

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

- Execute login in Swagger: a successful response authorizes protected requests automatically
  through Swagger's standard bearer authorization state.
- Refresh and switch-organization responses also replace that same applied token.
- To enter a token manually, open **Authorize** and enter the bearer token there. If already
  authorized, click **Logout** first, then enter the new token and click **Authorize**.
  Both a raw token and a token prefixed with `Bearer ` are accepted.
- There is one token entry point: the standard **Authorize** dialog.
- The applied access token is persisted under a dedicated Swagger key in `localStorage`, so reloads
  and reopening the documentation restore it until JWT expiry or **Logout**. Passwords and refresh
  tokens are not stored. Swagger remains the single active authorization state; storage only restores it.
  Logout/token replacement also synchronize between documentation tabs on the same origin.
- An expired JWT is not restored on page load. An expiry timer also clears authorization while the
  page is open, with a recheck when the tab regains focus. Opaque manually entered tokens have no JWT
  expiry to inspect and remain until Logout; the API always verifies actual validity. If browser
  storage is blocked, authorization works on the current page but cannot survive a reload.
  Login or refresh must be executed explicitly when
  needed; Swagger does not refresh in the background. **Logout** removes only Swagger's local
  authorization and does not revoke an issued token on the server.

The helper uses Swagger UI's
[response interceptor and preauthorization API](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/)
and a [plugin](https://swagger.io/docs/open-source-tools/swagger-ui/customization/plugin-api/) to persist changes from the standard authorization actions.
Only successful responses from the same origin's three auth endpoints may automatically replace the token.

## Frontend API URL

The frontend `.env` should use:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```
