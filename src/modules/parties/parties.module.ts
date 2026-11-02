import { Module } from '@nestjs/common';
import { PartiesController } from './controllers/parties.controller';
import { PartiesService } from './services/parties.service';
import { UsersModule } from '@modules/users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [PartiesController],
  providers: [PartiesService],
  exports: [PartiesService],
})
export class PartiesModule {}
