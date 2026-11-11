/**
 * Provides the shared Prisma database client as Nest infrastructure.
 * Exports PrismaService for owning persistence adapters; contains no business routes.
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
