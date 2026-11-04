import { Module } from '@nestjs/common';
import { ImportsController } from './controllers/imports.controller.js';

@Module({
  controllers: [ImportsController],
})
export class ImportsModule {}
