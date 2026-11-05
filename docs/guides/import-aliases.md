# Import aliases and ESM

The API uses native ESM on Node 24. `package.json` declares `"type": "module"`; TypeScript uses
`module: NodeNext` and `moduleResolution: NodeNext`. Application imports name the **output `.js` file**
even when the source file is `.ts`:

```ts
import { PrismaService } from '@database/prisma.service.js';
import { UserStatus } from '@generated/prisma/client.js';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto.js';
import { ProtectedApi } from '@auth/decorators/auth-api.decorator.js';
import { PaymentsModule } from '@modules/payments/payments.module.js';
import { CreatePartyDto } from '../dto/create-party.dto.js';
```

Directory barrels require `/index.js`. Bare package imports such as `@nestjs/common` keep their
package names. Cross-feature imports still require the owning module and its named `public/` contract.

Absolute internal imports use short owner aliases: `@auth/*`, `@common/*`, `@config/*`,
`@database/*`, `@generated/*` and `@modules/*`. `tsconfig.json` → `compilerOptions.paths` owns their
source mapping. Vitest maps the same prefixes to source. Do not introduce `#` aliases, a project-name
prefix or a second spelling such as `@/common/*`. Relative imports remain appropriate inside a feature.
Cross-feature imports still use named `public/` contracts and the owning Nest module.

TypeScript does not rewrite aliases in emitted JavaScript. `scripts/rewrite-build-aliases.mjs` uses
`tsc-alias` to rewrite compiled imports and declarations to relative paths with `.js` extensions.
`npm run build` runs this step after Nest compilation, including the Swagger plugin. The Nest CLI
`exec` setting preloads the same rewrite step before starting each compiled application during
`npm run dev` and `npm run debug`, so watch rebuilds finish rewriting before Node starts.
Do not run `nest build` alone as a deployment build; use `npm run build` / `npm run build:prod`.

`npm start`, Vercel and Docker run plain Node against the rewritten ESM artifact. Production needs
neither an alias loader nor `tsc-alias`; it is a build-only dev dependency. `package.json` has no
`imports` or `exports` alias mapping. When adding an alias, update TypeScript, Vitest and the relevant
architecture fixtures together and verify the compiled standalone/Vercel runtime, not only unit tests.

Standalone seed/import scripts run through `tsx`, which reads the same TypeScript paths. They name
the generated client source explicitly; running them requires authorization for the target database.
Use `import.meta.dirname`/`import.meta.url` instead of CommonJS globals. Prefer native `import`;
`createRequire(import.meta.url)` is reserved for a dependency or compiled test graph that needs it.

Dev/watch uses `tsconfig.dev.json` and emits to `dist-dev/` with its own incremental state. Production
builds emit to `dist/`. Do not point both at the same output: a separate build can remove `main.js`
while an incremental watcher only re-emits changed files, causing Nest to fall back to `dist/main`.
The alias pre-start hook selects the matching tsconfig from the compiled entrypoint. Asset output
follows the active compiler output directory rather than a hard-coded `dist` asset destination.
Restart an already-running watcher after updating this configuration.
