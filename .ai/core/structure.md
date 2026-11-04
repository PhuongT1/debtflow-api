# Structure, naming and Nest ownership

- MUST locate business code in the owning feature, using the project's configured layout. Search
  existing helpers/callers first. Create only files needed for the requested behavior.
- Use kebab-case files with responsibility suffixes: `orders.controller.ts`, `orders.service.ts`,
  `orders.module.ts`, `create-order.dto.ts`, `update-order.dto.ts`, `order-response.dto.ts`.
  Classes use PascalCase and the matching role: `OrdersController`, `CreateOrderDto`.
  Methods/variables use camelCase; shared constants use UPPER_SNAKE_CASE. Use domain action names.
- A controller binds transport input/context, declares access and response metadata, and delegates
  to a use-case service. It MUST NOT create database clients or perform persistence/calculations.
- A service owns business decisions and persistence orchestration. Keep controller imports,
  response formatting, Swagger and Express/Fastify response objects out of business services.
  Transport adapters may use transport types when that is their actual responsibility.
- Every provider MUST have one owning module. Import the owner's exported provider through its
  module; do not redeclare it in consumers or construct injectable services with `new`.
  Register controllers/providers and connect new modules to the application module tree.
  Export only for an actual consumer. Do not hide cycles with unexplained `forwardRef` calls.
- Keep infrastructure independent of business features. Shared code needs real reuse and a clear
  responsibility; moving feature logic into `common` to hide a cycle is not a solution.
- Extract a named pure helper for complex reusable decisions. Do not create `utils.ts`, generic
  base repositories, a command bus, request context or extra packages without an actual need.
- Use the existing guards, pipes, filters, interceptors and decorators at their intended boundaries.
  Register their lifecycle deliberately. Avoid per-request global subscriptions or duplicate clients.
- Follow the installed TypeScript/lint configuration. Do not silence errors with `any`, unchecked
  casts, `@ts-ignore` or blanket lint disables. Narrow `unknown` at untyped boundaries.

Typical grouped shape for a feature with multiple responsibilities (adapt to the project):

```text
<feature-root>/orders/
  orders.module.ts
  controllers/orders.controller.ts
  services/orders.service.ts
  _test/orders.service.spec.ts
  dto/create-order.dto.ts
  dto/update-order.dto.ts
  dto/order-response.dto.ts
```

Read-only features do not need create/update DTOs. Add query configuration, a mapper or rule helper
only when the feature needs it. Verify Nest registration and actual consumers, not just file names.

## Grow by responsibility, not a fixed folder template

The example is a starting point, not an exhaustive list of allowed files. Follow the project's folder
convention for small features too; do not create unused scaffolding. As responsibilities emerge, use `services/`, `queries/`,
`rules/`, `jobs/`, `integrations/` or nested domain modules. Create only the folders needed by the task;
do not impose controller/service/repository/domain/application layers on every feature.

Extract a provider or child module when it has a coherent use case, separate lifecycle, consumers or
test boundary. File length alone is not a reason to split. Keep the feature's exported interface small
and avoid imports into another feature's private helpers. A shared service needs one owning module,
even when HTTP routes, scheduled jobs, workers and webhooks all call it.

Public/protected describes transport access, not separate copies of a business domain. If a domain
needs several entry points, reuse its use-case service with explicit trusted context and policy for
each caller. A worker has no HTTP guard; its service boundary must still enforce relevant invariants.
Changing a project's feature root or module ownership requires updating callers, registrations, aliases,
architecture gates and documentation together; do not move the whole tree incidentally.

Use an injectable adapter/token or strategy when an actual integration varies, such as two storage
providers. Do not add an interface for every service merely to appear extensible. Extract a workspace
package only for a concrete independent consumer, build/release boundary or published extension.
Keeping `src/` in one application does not limit those options.

Follow the project's test placement policy. Keep specs and test-only fixtures in the owner's
`_test/` folder, outside production responsibility folders and build output. Moving tests requires
updating imports, runners, references and documented commands together. See [Testing](testing.md).


Place constants by owner and actual callers. Reuse the existing shared constants location for
cross-feature contracts; keep feature-only values with the feature and private implementation values
near their use. Do not create another constants folder/file or duplicate an enum without checking
existing owners. Name constants for their meaning and functions for their actual input/output/action.
