import { ApiEnvelope } from '#common/http/api-envelope.decorator.js';
import { CatalogOptionsResponseDto } from '../dto/catalog-response.dto.js';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '#auth/decorators/current-user.decorator.js';
import { ProtectedApi } from '#auth/decorators/auth-api.decorator.js';
import type { JwtAuthPayload } from '#auth/types/auth-context.types.js';
import { CatalogService } from '../services/catalog.service.js';
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
  @ApiEnvelope(CatalogOptionsResponseDto)
  options(@CurrentUser() u: JwtAuthPayload) {
    return this.service.options(u.organizationId);
  }
}
