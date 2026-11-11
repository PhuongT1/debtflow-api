# Ownership, file names and Nest wiring

Vendure separates API resolvers, services and entities and uses named helpers inside the service
layer. DebtFlow keeps those responsibilities inside its existing feature-owned Nest modules.
See source map entries V01–V03, V12, V29 and V19–V20. The REST file names below are DebtFlow conventions.

## OWN-01 — choose the owner before creating a file

Use a compact feature layout. One ordinary responsibility stays at the feature root; a folder is
created when it has at least **two related files**. Keep `dto/` separate even with one file. The
explicit architecture boundaries `_test/`, `repositories/` and `infrastructure/` also stay
separate even with one file. Keep `public/` for deliberate provider contracts where used; DTO/type-only
contracts can be imported from their actual owner without a forwarding file. Do not add filler files to satisfy the threshold.

```text
src/modules/parties/
  parties.module.ts
  parties.controller.ts
  parties.service.ts
  party.mapper.ts
  party.types.ts
  dto/
  repositories/parties.repository.ts
  infrastructure/
    prisma-parties.repository.ts
    queries/                         # multiple SQL helpers
  queries/                           # list config, projection, filter composition
  _test/
```

When a second service/controller/mapper/types/rules/query file is needed, group the existing and
new files in the relevant folder and update every import, Nest binding, test and reference in the
same change. Debts, Dashboard and Users keep `services/` because they have cooperating providers.
Use role suffixes (`*.controller.ts`, `*.service.ts`, `*.mapper.ts`, `*.types.ts`, etc.) so the root
stays readable. Never create empty folders or a second definition just to justify a folder.
A short helper does not require a framework, generic base service/repository or an extra layer.

All unit, HTTP and database specs and test-only fixtures MUST live in the owner's `_test/` folder:
`src/modules/<feature>/_test/`, `src/auth/_test/`, `src/config/_test/`, or
`src/common/<responsibility>/_test/`. Application composition tests live in `src/_test/`.
Do not leave `.spec.ts` beside production providers/mappers/queries or gather feature tests into
one global folder. Subfolders within `_test/` are allowed when distinct suites need them.
Do not require a repository/mapper/interface for every service or split
by an arbitrary file-length threshold. New nested files still follow naming, dependency, registration
and verification rules. Keep cross-feature consumers on the owning module's intentional exports.

Domains live directly under `src/modules/<feature>/`, with access classification on routes. Do not
reintroduce public/protected folder trees or duplicate business services for a webhook, worker or
differently protected route. Reuse the owning provider with explicit context/policy; HTTP guards do
not secure background callers. Small modules may register controllers and providers in one Nest module. When an
independent worker must import only use-case providers, split that domain's HTTP adapter module from
its provider module; the worker imports the latter. Do not create those extra modules before needed.

## File responsibility headers and documentation helpers

Controller and module files MUST start with a brief header containing about two descriptive lines.
Describe the actual endpoint responsibility/delegated service, or registered providers/module bindings.
Do not claim a module exports/imports providers it does not, and update the header when its role changes.

Shared Swagger-only decorators live in `src/common/swagger/decorators/` and retain Nest's `Api` prefix:
`ApiEnvelope`/`ApiErrorEnvelopes` describe responses; `ApiListQuery` describes allowed query parameters.
Import them from this namespace, not the runtime query barrel. Keep `ListQuery`, its parser and pipe in
`common/query/`, and actual response wrapping in `common/interceptors/api-response.interceptor.ts`.
Shared envelope DTOs remain in `common/http/` because runtime response type aliases also reuse them.
`auth-api.decorator.ts` stays auth-owned: `PublicApi` has runtime metadata while `ProtectedApi` documents
security/error responses. Global guards enforce access; Swagger decorators do not.

## OWN-02 — names communicate the role

| Item                       | Required form                          | Example                                                |
| -------------------------- | -------------------------------------- | ------------------------------------------------------ |
| Production TypeScript file | lower-case kebab-case, dot role suffix | `create-party.dto.ts`                                  |
| Controller/service/module  | PascalCase ending in its Nest role     | `PartiesController`, `PartiesService`, `PartiesModule` |
| Request class              | operation + singular resource + `Dto`  | `CreatePartyDto`, `UpdatePartyDto`                     |
| Query class                | `Query` + plural resource + `Dto`      | `QueryPartiesDto`                                      |
| Response classes           | specific response purpose + `Dto`      | `PartyResponseDto`, `PartyListItemDto`, `MemberDto`    |
| List config/constant       | UPPER_SNAKE_CASE                       | `PARTY_LIST_QUERY`, `PASSWORD_ROUNDS`                  |
| Method/variable            | camelCase, behavior-oriented verb      | `assertAssignee`, `buildPartyUpdateData`               |
| Test                       | owned `_test/<subject>.spec.ts`           | `users.rules.spec.ts`                                  |

Prefer established service method names (`list`, `detail`, `create`, `update`, `deactivate`) when their
meaning fits. A domain operation such as `reactivate`, `cancel` or `createAutoAllocated` should name
its business action. Do not rename compatible existing public methods solely to mimic Vendure's
`findAll`/`findOne`. Local imports follow the short `@auth/*`, `@common/*`, `@config/*`, `@database/*`, `@generated/*` and `@modules/*` aliases declared in `tsconfig.json` and the ESM import guide; same-feature relative
imports use explicit `.js` suffixes. Public DTO classes may share a response file when they describe one resource contract.

## OWN-03 — wire exactly one provider owner

An illustrative existing module pattern is:

```ts
@Module({
  controllers: [PartiesController],
  providers: [PartiesService],
  exports: [PartiesService],
})
export class PartiesModule {}
```

MUST connect a new domain module to its consumer module or the `AppModule` composition root.
`AuthApiModule` owns session/profile controllers and `AuthService`; the shared `AuthModule` owns JWT infrastructure/global guards.
Export a provider only for an actual external consumer. A consumer imports the owning module and
injects its exported service; it MUST NOT redeclare that service in its own `providers`, construct it
with `new`, or use `forwardRef` as an unexplained cycle workaround. Truly application-wide providers
already owned by `AuthModule`, `DatabaseModule`, `I18nModule` or the event infrastructure retain that
ownership; do not register another client/guard/filter instance inside a feature.

Vendure's `ServiceCoreModule` explicitly avoids multiple lifecycle instantiations. That is the lesson;
copying its central list of hundreds of providers into this single API is not required.

## OWN-04 — dependency and file boundaries

- `common`, `config` and `database` MUST NOT depend on features or auth. `src/auth` infrastructure MUST NOT depend on features. The architecture checker
  resolves aliases and relative imports to enforce this. Tests and generated files are excluded.
- Controllers delegate to services; services/listeners inject repository contracts. Only feature
  `infrastructure/` imports the database layer or PrismaClient. Modules bind contract to adapter.
  Generated enums/Decimal values and owned projection types remain allowed; see DB-06.
  Business use-case services under features/auth MUST NOT import controllers, Express `Request`/`Response`, `@nestjs/swagger` decorators or
  call HTTP `res.json`. The existing auth payload is bound at the route boundary, then pass the
  explicitly needed identity/context into the use case.
  Infrastructure adapters such as `I18nService.resolveLocale(Request)` may accept transport objects
  for their boundary responsibility; that does not make Express a business-service dependency.
- Shared patterns MUST have one implementation. Reuse the validation pipe, list parser, pagination,
  envelope/filter and audit emitter. Avoid per-feature copies with slightly different behavior.
- Backend source MUST NOT import sibling frontend/Vendure source. Reference it to learn a pattern,
  then implement with this repository's dependencies and domain contracts.
- Scratch code and unrelated CV/document scripts do not belong in `scripts/`. Do not move/delete
  existing unrelated files while cleaning up a backend task without authorization.

**Acceptance:** show the owning folder, Nest registration/export path and callers. The import check
and build must pass; a passing build alone does not prove duplicate provider lifecycles are harmless.

## OWN-05 — TypeScript and cross-cutting extension points

Use the repository's strict TypeScript/ESLint settings; do not introduce `any`, blanket lint disables,
`@ts-ignore` or casts to turn unvalidated input into a trusted type. Use `unknown` plus a real narrowing
check at an untyped boundary. Service/result types must reflect the returned shape; explicit public
return types are useful where inference would expose an accidental database field or unstable union.
Constructor-injected dependencies SHOULD be `private readonly`; keep constants with their owner and
do not introduce mutable global request/tenant state.

Use the existing Nest extension mechanism when adding one is warranted: `<purpose>.guard.ts` /
`PurposeGuard` for access policy, `.pipe.ts` / `PurposePipe` for input transformation/validation,
`.filter.ts` / `PurposeFilter` for exception mapping, `.interceptor.ts` / `PurposeInterceptor` for
cross-cutting request/response behavior, `.decorator.ts` for binding/metadata and `.listener.ts` /
`PurposeListener` for subscribed effects. Register them with the owning module and correct lifecycle;
do not rebuild global envelope/validation/auth behavior inside each controller.

A strategy/interface is justified by a concrete variation or integration boundary, not merely because
Vendure has strategy folders. Prefer a named function/helper for a pure rule. Avoid a generalized
repository, CQRS bus, plugin engine or global request context when the actual task only needs a small
use case. If an exception is necessary for a documented runtime constraint, scope and explain it
instead of making it the default pattern.


## OWN-06 — locate constants by ownership

Search existing constants and callers before adding a definition. Constants shared by feature HTTP
adapters belong in the existing `src/common/constants/` folder: `api-routes.constants.ts` owns
`API_PREFIX` and `API_ROUTES`; `api-tags.constants.ts` owns Swagger group names. Use `PREFIX` for a
controller prefix, `BY_ID` for an item path and descriptive action names for subpaths.

Business constants used only by a feature belong in that feature (a focused `<concern>.constants.ts`
or its existing `constants/` folder). A private value used by one implementation can stay beside it.
Concern-specific infrastructure constants stay with their owner, such as validation's
`phone.constants.ts` and Swagger's private asset configuration. Do not dump every constant into a
global registry or create duplicate generic `constants.ts` files without an owner. Reuse Prisma
enums and existing values rather than redeclaring them.

Vendure illustrates both scopes: `packages/core/src/common/constants.ts` holds shared infrastructure
values, while `health-check/constants.ts`, `job-queue/constants.ts` and `api/constants.ts` stay with
their respective owners. DebtFlow uses its existing shared constants directory for the public REST
path/tag contract; it does not import Vendure's constants or assume its GraphQL paths match REST.

## Read-query file names

Name pure read helpers by their output: `*.list-query.ts` for the HTTP filter/sort capability
configuration, `*.query.ts` for Prisma argument composition, `*.select.ts` for typed Prisma
projections, and `*.sql.ts` for TypeScript functions producing SQL fragments/statements. SQL builders
belong to the owning feature's infrastructure; repository adapters execute them. A `.sql.ts` suffix
still denotes TypeScript, not a standalone `.sql` file or Prisma TypedSQL. Do not imply CQRS
QueryBus/QueryHandler usage when the feature only has pure query builders.

For Parties, `infrastructure/sql/party-balance-page.sql.ts` builds the aggregate/page statement;
`party-filter.sql.ts` adapts the canonical Prisma predicate subset. Both are executed/consumed through
the owning Prisma repository, with no additional provider or database connection.

Keep shared capability definitions, Prisma argument builders and projections in the feature's
`queries/` folder when multiple files are needed. Put private PostgreSQL fragment/statement builders
in `infrastructure/sql/`, rather than another folder called `queries/`. Repository adapters execute
those statements. Shared DTOs/mappers/types must not depend on infrastructure just to reuse
projection keys or inferred payloads. Keep one projection source, not a forwarding or duplicate copy.
