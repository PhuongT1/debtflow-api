/**
 * Registers tenant catalog lookup HTTP handlers and the application service.
 * Binds CatalogRepository to its Prisma adapter for tenant-scoped catalog reads.
 */
import { CatalogRepository } from './application/repositories/catalog.repository.js';
import { PrismaCatalogRepository } from './infrastructure/prisma-catalog.repository.js';
import { Module } from '@nestjs/common';
import { CatalogController } from './presentation/catalog.controller.js';
import { CatalogService } from './application/catalog.service.js';

@Module({
  controllers: [CatalogController],
  providers: [
    { provide: CatalogRepository, useClass: PrismaCatalogRepository },
    {
      provide: CatalogService,
      inject: [CatalogRepository],
      useFactory: (repository: CatalogRepository) => new CatalogService(repository),
    },
  ],
})
export class CatalogModule {}
