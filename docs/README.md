# DebtFlow API Documentation

Start here. Pages are ordered from "what is this" to "how is it built".

| #   | Page                                                   | Read it when you want to know...                                         |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1   | [Product Overview](./01-overview.md)                   | what the product does, who uses it, the feature map and glossary         |
| 2   | [Architecture](./02-architecture.md)                   | how the system, modules, auth, tenancy and the web frontend fit together |
| 3   | [Business Rules](./03-business-rules.md)               | roles, debt lifecycle, payment allocation, reports, known gaps           |
| 4   | [Database](./04-database.md)                           | the data model, relationships, enums and conventions                     |
| -   | [API Reference](./generated/api-reference.md)          | every endpoint, its roles, parameters and bodies (generated)             |
| -   | [Database ERD and dictionary](./generated/database.md) | every table and column (generated)                                       |
| -   | [OpenAPI JSON](./generated/openapi.json)               | the machine-readable spec (generated)                                    |

## Reading paths

- **New developer**: Overview -> Architecture -> [Run Source](./guides/run-source.md) -> Business Rules.
- **Frontend developer**: Overview -> [API Reference](./generated/api-reference.md) -> [API Response Format](./guides/api-response-format.md).
- **Tester / QA**: Business Rules -> API Reference -> Postman collection in [`postman/`](../postman).
- **Database change**: Database -> [Database Workflow](./guides/database-workflow.md).

## Guides (how-to)

AI-assisted backend work starts at the root `AGENTS.md` and the
[AI Backend Development guide](./guides/ai-development.md).

New members: run `npm run ai:setup` and `npm run ai:check`. See
[team AI setup and portable NestJS core](./guides/ai-setup.md) for client support and reuse in another repo.
Implementation requirements are in [Backend Rules](./guides/backend-rules/index.md), with
[Vendure source evidence](./guides/backend-rules/vendure-source-map.md).

[Maintainability and reuse](./guides/backend-rules/maintainability.md) defines responsibility folders,
type/DTO ownership, query reuse and the limits of the automated duplication checks.

| Guide                                                         | Topic                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [Run Source](./guides/run-source.md)                          | install, environment, run, seed                                                 |
| [API And Swagger](./guides/api-and-swagger.md)                | Swagger URLs and manual calls                                                   |
| [API Response Format](./guides/api-response-format.md)        | success, error and pagination envelope                                          |
| [List Query](./guides/list-query.md)                          | one convention for pagination, `sort` and `filter[field][op]` on every list API |
| [Localization](./guides/localization.md)                      | EN/VI via `Accept-Language`, how messages and errors are translated             |
| [Request Flow](./guides/request-flow.md)                      | walkthrough of a request through the code                                       |
| [Database Workflow](./guides/database-workflow.md)            | migrations and Prisma Client                                                    |
| [Project Structure](./guides/project-structure.md)            | folder layout                                                                   |
| [Authentication And Authorization](./guides/authorization.md) | guards and role policy                                                          |
| [Validation And Errors](./guides/validation-and-errors.md)    | DTO validation and error format                                                 |
| [Import Aliases](./guides/import-aliases.md)                  | TypeScript path aliases                                                         |

## Decisions

- [ADR 0001: Tenant isolation by organizationId](./adr/0001-tenant-isolation-by-organization-id.md)
- [ADR 0002: Documentation as code with generated reference](./adr/0002-docs-as-code-with-generated-reference.md)
- [ADR 0003: List query modeled on Vendure's ListQueryBuilder](./adr/0003-list-query-modeled-on-vendure.md)
- [ADR 0004: Audit log through domain events](./adr/0004-audit-log-through-domain-events.md)

## View this documentation as a website

```bash
npm run docs:dev       # http://localhost:5173 with hot reload and search
npm run docs:build     # static site in docs/.vitepress/dist
npm run docs:preview   # serve the built site locally
```

The site is [VitePress](https://vitepress.dev) reading these same Markdown files, so GitHub and the
site stay identical. Mermaid diagrams render in both. The `dist` output is plain static HTML and can be
hosted anywhere (Vercel, GitHub Pages, Netlify); set the output directory to `docs/.vitepress/dist` and the
build command to `npm run docs:build`. If you host it under a sub-path, set `base` in
`docs/.vitepress/config.mts`.

## Keeping the docs correct

| Content                        | Maintained by                                                  | Command                 |
| ------------------------------ | -------------------------------------------------------------- | ----------------------- |
| `docs/generated/*`             | generated from code, **do not edit**                           | `npm run docs:generate` |
| Drift check (CI / before a PR) | compares generated output with the committed files             | `npm run docs:check`    |
| Pages 1-4, guides, ADRs        | written by hand; update in the same PR as the behaviour change | -                       |

Rules of thumb: new endpoint -> add `@ApiTags`/`@ApiOperation` and DTO decorators; new Prisma model or column
-> add a `///` comment; behaviour change -> update [Business Rules](./03-business-rules.md); architectural decision -> add an ADR.
