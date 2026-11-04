# Ownership, file names and Nest wiring

Vendure separates API resolvers, services and entities and uses named helpers inside the service
layer. DebtFlow keeps those responsibilities inside its existing feature-owned Nest modules.
See source map entries V01–V03, V12, V29 and V19–V20. The REST file names below are DebtFlow conventions.

## OWN-01 — choose the owner before creating a file

Group feature files by responsibility; create only the folders with actual files:

```text
src/modules/<plural-feature>/
  <plural-feature>.module.ts       # Nest registration and explicit exports
  controllers/
    <plural-feature>.controller.ts # routes, context, policy, documentation
  services/
    <plural-feature>.service.ts      # use-case orchestration and persistence
    <plural-feature>.service.spec.ts # observable service behavior
  queries/                          # only when query responsibilities exist
    <plural-feature>.list-query.ts   # public filter/sort capabilities
    <singular>-query.ts              # shared query composition, when needed
  dto/
    create-<singular>.dto.ts       # create request, if supported
    update-<singular>.dto.ts       # partial update, if supported
    query-<plural-feature>.dto.ts  # resource-specific list parameters
    <singular>-response.dto.ts    # related public response classes
```

MUST create only files needed for the requested capability. Read-only features do not need fake
create/update DTOs, and a two-line mapping does not require a mapper framework. Add a named
`<responsibility>.service.ts` or helper when a distinct concern has callers/tests, not to satisfy a
line-count target. Existing useful examples: `mappers/party.mapper.ts`, `rules/users.rules.ts`, `services/debt-line-item.service.ts`.
Do not add `utils.ts`, `misc.ts`, `base.service.ts`, `generic.repository.ts` or a new top-level folder
without identifying the concrete responsibility and why existing ownership is insufficient.

This template is not a closed list. A growing feature may use focused `services/`, `queries/`,
`rules/`, `jobs/`, `integrations/` or child domain modules when the task needs them. Existing
`DebtLineItemService` and `DashboardActionCenterService` demonstrate splitting by responsibility.
Use responsibility folders consistently for small features too. Group cooperating providers in `services/`, list config
and query/date builders in `queries/`, and nested document item inputs in `dto/items/` when present.
Keep tests adjacent to their subject. Do not require a repository/mapper/interface for every service or split
by an arbitrary file-length threshold. New nested files still follow naming, dependency, registration
and verification rules. Keep cross-feature consumers on the owning module's intentional exports.

Domains live directly under `src/modules/<feature>/`, with access classification on routes. Do not
reintroduce public/protected folder trees or duplicate business services for a webhook, worker or
differently protected route. Reuse the owning provider with explicit context/policy; HTTP guards do
not secure background callers. Small modules may register controllers and providers in one Nest module. When an
independent worker must import only use-case providers, split that domain's HTTP adapter module from
its provider module; the worker imports the latter. Do not create those extra modules before needed.

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
| Test                       | adjacent `<subject>.spec.ts`           | `users.rules.spec.ts`                                  |

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
- Controllers MUST delegate database access to services; enums/types from generated Prisma are fine.
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
