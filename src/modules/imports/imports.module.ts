/**
 * Registers the placeholder debt-import HTTP controller.
 * The import parser and database write workflow are not implemented here.
 */
import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller.js';

@Module({
  controllers: [ImportsController],
})
export class ImportsModule {}
