# Import Aliases

This project uses TypeScript path aliases without deprecated `baseUrl`.

Examples:

```ts
import { PrismaService } from '@database/prisma.service';
import { UserStatus } from '@generated/prisma';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { ProtectedApi } from '@auth/auth-api.decorator';
import { AuthModule } from '@auth/auth.module';
import { PublicModule } from '@modules/public/public.module';
import { ProtectedModule } from '@modules/protected/protected.module';
```

Aliases are defined in:

```txt
tsconfig.json
```

Current aliases:

```json
{
  "@/*": ["./src/*"],
  "@auth/*": ["./src/auth/*"],
  "@common/*": ["./src/common/*"],
  "@config/*": ["./src/config/*"],
  "@database/*": ["./src/database/*"],
  "@generated/*": ["./src/generated/*"],
  "@modules/*": ["./src/modules/*"]
}
```

`tsc-alias` rewrites aliases after build so compiled Node.js output can run.

Do not re-add deprecated `baseUrl`.
