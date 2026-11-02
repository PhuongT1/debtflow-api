import { Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProtectedApi } from '@auth/decorators/auth-api.decorator';
import { Roles } from '@auth/decorators/roles.decorator';
import { OrganizationRole } from '@generated/prisma';

@ApiTags('Imports')
@ProtectedApi()
@Controller('imports')
export class ImportsController {
  @ApiOperation({
    summary: 'Import debts from Excel (scaffold)',
    description: 'Not implemented yet: returns a placeholder message and imports nothing.',
  })
  @Post('debts')
  @Roles(OrganizationRole.ADMIN, OrganizationRole.ACCOUNTANT)
  debts() {
    return {
      message:
        'Import Excel endpoint scaffolded. Port parser from web src/features/imports before enabling production import.',
    };
  }
}
