import { Module } from '@nestjs/common';
import { PartiesController } from './controllers/parties.controller.js';
import { PartiesService } from './services/parties.service.js';
import { UsersModule } from '#modules/users/users.module.js';

@Module({
  imports: [UsersModule],
  controllers: [PartiesController],
  providers: [PartiesService],
  exports: [PartiesService],
})
export class PartiesModule {}
