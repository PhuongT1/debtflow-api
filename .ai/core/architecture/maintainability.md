# Reuse and maintainable changes

Read this topic before adding/changing providers, DTOs, shared contracts or query builders.

## Find the existing owner first

Search the source and callers for the fields, validation decorators and behavior being added. Read
the actual implementation before creating another definition. Reuse an existing contract only when
its meaning, trust boundary, null behavior and lifecycle match. Similar field names alone are not
evidence of the same contract. Explain a deliberately separate contract when it resembles an existing one.

Choose the smallest appropriate form:

| Need                                                          | Preferred form                                                                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Same runtime request validation with selected/optional fields | Existing DTO plus framework mapped types or inheritance; verify runtime metadata, null behavior and API schema |
| Compile-time subset/extension of an existing contract         | `Pick`, `Omit`, indexed access or intersection from its owner                                                  |
| Result of a database query                                    | ORM-generated payload derived from the actual typed projection/include, or inference                           |
| One local intermediate value                                  | Inference; do not export a new interface merely to name it                                                     |
| Public response                                               | An explicit safe response DTO/mapper; a database entity is not automatically a public response                 |
| Same normalization, rule or query used repeatedly             | One named function at the narrowest common owner, with the callers' semantics verified                         |

MUST NOT manually mirror a generated database model or copy a shared contract's fields when its
owner can express the actual shape. Keep projections and their derived payload types connected.
Select sensitive fields only where needed; extending a full database record or returning a spread
of it can expose credentials. DTO reuse does not authorize mass assignment: map writable fields
explicitly and keep actor, access policy and scope server-owned.

Runtime DTO classes carry validation/serialization metadata; type aliases/interfaces do not.
Type-only DTO imports do not provide runtime metadata. An update may intentionally have different
null, required-field or permission semantics; do not apply `PartialType` mechanically.

## Make the place to edit visible

Follow the project's compact layout consistently: a single ordinary responsibility stays at the
feature root; group related controllers, services, queries, types, mappers or rules when there are
at least two files. Keep DTOs and project-defined architectural boundaries separate even with one
file. File suffixes and dependency direction still apply to root-level files. Keep tests in the subject owner's `_test/` folder, following the project testing policy. Create only folders with real files.
Use child domain modules when they have a coherent boundary or independent consumers.

Shared contracts belong with their domain, not exported from executable service/controller files.
Do not borrow a constant/function from another feature's request DTO. A genuinely shared validation
constant belongs in shared validation infrastructure; a domain-specific rule stays in its domain.
Avoid global catch-all `types.ts`, `utils.ts`, base services and repositories that hide ownership.

## Keep orchestration readable

Use a named typed query builder for reusable or multi-step filter/date composition. Keep the tenant
scope explicit. Prefer assignments for optional conditions and deliberate `AND` composition when
filters constrain the same field; do not use nested conditional spreads or field overwrites that hide
which filters apply. Keep list count, report and export semantics consistent where they share filters.

Extract a coherent responsibility, not every three-line statement. Reuse repeated aggregations,
mapping and normalization only when the semantics match; preserve Decimal/date/null behavior. Keep
transport headers and response objects at the controller, with document generation in its owned service.
Do not invent a generic query framework, inheritance hierarchy or integration plugin system to remove
small differences between unrelated use cases.

## Verify the refactor

Trace all callers, imports and Nest provider registrations when moving code. Compare actual API
schemas and status/validation behavior when deriving DTOs. Cover changed mapping, query composition,
money and authorization boundaries with targeted regression tests. Run the project's structure and
duplication gates. Exact-token checks detect only some clones; semantic reuse still requires reading
the code. Report remaining debt rather than declaring an entire project duplication-free.

## One policy across entry points

When the same business concept appears in list, detail, report, export or background processing,
identify one rule owner. Test agreement at boundary values; matching helper bodies is not enough.
Keep scope, related-resource checks and transaction propagation on service boundaries. For PATCH,
normalization must not convert an omitted field into a clear operation.

Follow the project's explicit public import boundary for cross-feature contracts. Share in-process
use cases through the owning module/provider rather than calling internal controllers or making HTTP
requests back to the same application. Export only intended names; a public barrel is not permission
to expose every private helper. External API clients belong to deliberate integration adapters.
