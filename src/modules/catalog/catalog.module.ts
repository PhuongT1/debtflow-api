import { CatalogRepository } from './repositories/catalog.repository.js';
import { PrismaCatalogRepository } from './infrastructure/prisma-catalog.repository.js';
import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  controllers: [CatalogController],
  providers: [{ provide: CatalogRepository, useClass: PrismaCatalogRepository }, CatalogService],
})
export class CatalogModule {}
