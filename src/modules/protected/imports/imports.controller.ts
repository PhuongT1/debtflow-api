import { Controller, Post } from '@nestjs/common';
import { ProtectedApi } from '@auth/auth-api.decorator';
import { Roles } from '@auth/roles.decorator';
import { OrganizationRole } from '@generated/prisma';

@ProtectedApi()
@Controller('imports')
export class ImportsController {
  @Post('debts')
  @Roles(OrganizationRole.ADMIN, OrganizationRole.ACCOUNTANT)
  debts() {
    return {
      message:
        'Import Excel endpoint scaffolded. Port parser from web src/features/imports before enabling production import.',
    };
  }
}
