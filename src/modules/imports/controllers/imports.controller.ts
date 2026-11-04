import { HttpStatus } from '@nestjs/common';
import { ApiEnvelope } from '@common/http/api-envelope.decorator.js';
import { ImportScaffoldResponseDto } from '../dto/import-scaffold-response.dto.js';
import { Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProtectedApi } from '@auth/decorators/auth-api.decorator.js';
import { Roles } from '@auth/decorators/roles.decorator.js';
import { OrganizationRole } from '@generated/prisma/client.js';

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
  @ApiEnvelope(ImportScaffoldResponseDto, { status: HttpStatus.CREATED })
  debts() {
    return {
      message:
        'Import Excel endpoint scaffolded. Port parser from web src/features/imports before enabling production import.',
    };
  }
}
