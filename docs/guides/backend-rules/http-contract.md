# HTTP boundary and public contract

Vendure's Customer/Product/Role resolvers bind context and generated args, declare permissions,
delegate to services, and type their return. See V01–V05 and V08. Adapt that contract to REST here.

## HTTP-01 — route handlers bind, authorize and delegate

Every new controller MUST have `@Controller(...)`, `@ApiTags(...)` and an explicit auth classification
using `@ProtectedApi()` or `@PublicApi()`. Use resource-oriented plural paths for collections, path IDs
for a selected resource and a named action for a real domain transition. Static paths such as
`options` MUST not be swallowed by `:id` handlers. Do not invent an ID format such as UUID when the
Prisma model uses CUID/string IDs.

Each handler MUST declare `@ApiOperation` and its actual response contract. Bind whole body/query
objects with runtime DTO classes imported as values. `@CurrentUser()` binds the established auth
context; it is not a request body DTO and its interface/type import is allowed. Pass tenant and actor
from that context to the use case. Never take the acting role/tenant from a mutation body.

Pattern taken from the real Parties controller, with names shortened for illustration:

```ts
@ApiOperation({ summary: 'Create a party' })
@ApiEnvelope(PartyResponseDto, { status: HttpStatus.CREATED })
@ApiErrorEnvelopes({ badRequest: 'Validation failed.', conflict: 'Code already exists.' })
@Post()
@Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.ACCOUNTANT)
create(@CurrentUser() actor: JwtAuthPayload, @Body() input: CreatePartyDto) {
  return this.service.create(actor.organizationId, actor.sub, input);
}
```

Business permissions, state checks, related-ID checks and data writes belong in the service/rules.
Do not put authorization solely in Swagger descriptions or frontend button visibility.

## HTTP-02 — status and envelope must agree

| Operation                                      | Default contract for new routes                                 |
| ---------------------------------------------- | --------------------------------------------------------------- |
| List/detail/options                            | GET, 200                                                        |
| Create a resource                              | POST, 201; `ApiEnvelope(..., { status: HttpStatus.CREATED })`   |
| Partial update                                 | PATCH, 200; omitted properties stay unchanged                   |
| Soft-delete/suspend with returned data         | DELETE, 200                                                     |
| Reactivate/cancel/switch action returning data | explicit `@HttpCode(HttpStatus.OK)` when POST should return 200 |
| Truly empty response                           | explicit 204, no body and `@ApiNoContentResponse()`             |

MUST align Nest runtime status, documented status, response body and interceptor behavior. A POST
returns 201 by default even when it is named `reactivate`; `@ApiEnvelope` documents status but does
not set it. Do not return a JSON envelope with a 204 response. Preserve existing external contracts
unless a behavior change is authorized, and check callers when changing response shapes.

For JSON, return domain/result data and let the global response interceptor produce the envelope.
Use `@ApiEnvelope` with a concrete response DTO, `{ paginated: true }` for paginated data, or
`{ isArray: true }` for a nonpaginated array. Do not double-wrap with `{ success, data }` in the service.
If a response has a new shape, describe it rather than using `Object`/`any` to make documentation compile.

## HTTP-03 — separate public input and output

MUST NOT reuse a Prisma create/update input or database entity as the public request contract.
Response DTOs describe what is actually serialized: Decimal values as strings, Dates as ISO date-time,
nullable properties as nullable, and only deliberately exposed relations/fields. Select safe account
fields in queries; a response DTO annotation alone does not strip a password hash from a returned object.
Use an explicit mapper when the database and public representation differ (see `toMemberDto`).

Document expected 400/401/403/404/409 outcomes and stable error codes according to the relevant
business operation. Authentication wrappers already document common 401/403 outcomes. Never include
real credentials or tokens as examples. The known seed credentials are demo examples, not defaults
used by server authentication. Regenerate OpenAPI after changing decorators, DTOs or descriptions.

## HTTP-04 — file/stream exceptions are explicit

A binary response requires an explicit content type, download/stream contract and `@SkipApiResponse`.
Raw `@Res()` handling belongs only to such transport cases; validate its input with DTOs and scope
the underlying query exactly like a normal API. Bound export volume and document truncation or batch
behavior. Never return a partial capped export while describing it as the whole dataset.

**Acceptance:** compare the generated operation with an actual response or HTTP test, including status,
envelope, error details, content type and relevant role/tenant failures. AST checks only cover metadata.
