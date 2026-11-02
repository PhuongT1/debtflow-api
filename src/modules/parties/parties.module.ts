import { Module } from '@nestjs/common';
import { PartiesController } from './controllers/parties.controller';
import { PartiesService } from './services/parties.service';

@Module({
  controllers: [PartiesController],
  providers: [PartiesService],
  exports: [PartiesService],
})
export class PartiesModule {}
