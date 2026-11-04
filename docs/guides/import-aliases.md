# Import aliases and ESM

The API uses native ESM on Node 24. `package.json` declares `"type": "module"`; TypeScript uses
`module: NodeNext` and `moduleResolution: NodeNext`. Application imports name the **output `.js` file**
even when the source file is `.ts`:

```ts
import { PrismaService } from '#database/prisma.service.js';
import { UserStatus } from '#generated/prisma/client.js';
import { PaginationQueryDto } from '#common/dto/pagination-query.dto.js';
import { ProtectedApi } from '#auth/decorators/auth-api.decorator.js';
import { PaymentsModule } from '#modules/payments/payments.module.js';
import { CreatePartyDto } from '../dto/create-party.dto.js';
```

Directory barrels require `/index.js`. Bare package imports such as `@nestjs/common` keep their
package names. Cross-feature imports still require the owning module and its named `public/` contract.

The single runtime alias map is `package.json` → `imports`. Each `#auth/*`, `#common/*`, `#config/*`,
`#database/*`, `#generated/*` and `#modules/*` entry has `types` pointing to source for TypeScript
and `default` pointing to compiled `dist/src` for Node. Keep `package.json` beside `dist` in deployment.
Vitest maps these names to source when testing; compiled HTTP tests exercise Node's actual mappings.

Do not add `baseUrl`, duplicate `paths`, `tsc-alias`, CommonJS output or a runtime TS loader to start the
application. `npm run dev` compiles in watch mode; `npm start` runs the same native ESM artifact used by
Vercel and Docker. Standalone seed/import scripts run through `tsx` and name the generated client
source explicitly; running them requires authorization for the target database.

Use `import.meta.dirname`/`import.meta.url` instead of CommonJS globals. Prefer native `import`;
`createRequire(import.meta.url)` is reserved for a dependency or compiled test graph that needs it.
