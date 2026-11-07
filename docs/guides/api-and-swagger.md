# API And Swagger

## Local URLs

Set `PORT` in `.env` and start the backend. The terminal prints the actual Swagger URL
after the server starts; `<PORT>` below denotes that configured port (default 4000):

```txt
API base URL:  http://localhost:<PORT>/api
Swagger UI:    http://localhost:<PORT>/docs
OpenAPI JSON:  http://localhost:<PORT>/docs-json
```

Swagger loads `/docs-json` and sends API requests relative to the backend origin, so a port change
requires no browser-script change. On Vercel, use the deployment origin plus `/docs`; no localhost
URL is embedded in the OpenAPI document. The standalone startup log uses the bound address and
actual port, including an OS-assigned port when `PORT=0`.

## Where to make changes

`configureApp()` calls `configureSwagger()` and returns its OpenAPI document. The live `/docs-json`
route and `scripts/generate-api-docs.ts` use that same document; do not maintain a handwritten API spec.

| Change                                                                                | Edit this owner                                                                                    |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Endpoint, input/output or response description                                        | Owning feature controller and DTO; shared response decorators in `common/decorators/`              |
| Exposed sort/filter fields                                                            | Feature `*.list-query.ts`; shared `common/query/list-query.swagger.ts` renders their documentation |
| Swagger group names (`Auth`, `Parties`, etc.)                                         | `src/common/constants/api-tags.constants.ts`; controllers import `API_TAGS`                        |
| API title, version, bearer scheme, global headers or documentation route registration | `src/common/swagger/swagger.setup.ts`                                                              |
| Documentation URLs, page HTML or pinned Swagger UI asset version                      | `src/common/swagger/swagger-ui.ts`                                                                 |
| Automatic login token, persistence, expiry and Logout                                 | `src/common/swagger/swagger-auth.js`; extend `common/swagger/_test/swagger-auth.spec.ts`           |
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
helper, run its `_test/` suite, `npm run typecheck` and `npm run lint`. `npm run build` must finish before running the full
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
NEXT_PUBLIC_API_URL=http://localhost:<PORT>/api
```

`@ApiTags(API_TAGS.PARTIES)` assigns a documentation group. It does not register an endpoint,
a permission or an API prefix. Keep `@Controller`, route methods, DTOs and policy with their
feature; OpenAPI derives the complete endpoint list from that code. The shared tag registry is
also registered by `createOpenApiDocument()`; the compact endpoint catalog is generated from the same document.

Endpoint discovery: [Endpoint catalog](../generated/endpoints.md) lists every HTTP method and URL from the compiled OpenAPI document.
Path definitions live in `src/common/constants/api-routes.constants.ts`; controllers use `API_ROUTES`
for `@Controller(...)` and named method paths. HTTP verbs, policy and implementations remain in
the owning controllers. Run `npm run docs:generate` after a route change; do not edit the catalog.

## Party generated response base (pilot)

`npm run db:generate` also runs `scripts/generate-response-models.mjs` through Prisma's generator
protocol. It generates `PartyBase` with scalar types and explicit Swagger metadata into ignored
`src/generated/response-models/`. This pilot generates Party only; it uses the existing generator
helper dependency and does not install a third-party class generator. Do not hand-edit the output.
The build runs generation before compilation, including Vercel and Docker builds.

`parties/queries/party.select.ts` owns `PARTY_RESPONSE_FIELDS`, the explicit scalar allow-list shared
by `PickType(PartyBase, ...)` and the response mapper. New database columns appear in the generated
base but are not automatically exposed by Party endpoints or their schemas. `creditLimit` is
customized to a nullable decimal string; list balances are also serialized without floating-point
conversion. Existing fields, including `searchText`, remain in the current contract.

Party controllers apply the mapper to create/update/deactivate, list items and detail results before
the shared response interceptor builds the envelope. Request DTO validation stays unchanged.
This is generated base + mapped types + explicit mapping, not Zod or runtime response validation.
Other feature DTOs may reuse the Party contract; their persistence and response mapping are unchanged.
