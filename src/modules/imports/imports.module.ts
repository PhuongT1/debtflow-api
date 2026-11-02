import { Module } from '@nestjs/common';
import { ImportsController } from './controllers/imports.controller';

@Module({
  controllers: [ImportsController],
})
export class ImportsModule {}
