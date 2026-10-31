import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@auth/current-user.decorator';
import { ProtectedApi } from '@auth/auth-api.decorator';
import type { JwtAuthPayload } from '@auth/jwt-auth.guard';
import { CatalogService } from './catalog.service';
@ApiTags('Catalog')
@ProtectedApi()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @ApiOperation({
    summary: 'Get filter options',
    description: 'Active categories, brands, products and the provinces that have parties.',
  })
  @Get('options')
  options(@CurrentUser() u: JwtAuthPayload) {
    return this.service.options(u.organizationId);
  }
}
