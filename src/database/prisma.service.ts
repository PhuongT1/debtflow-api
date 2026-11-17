import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { appConfig, type AppConfig } from '@config/app.config.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(appConfig.KEY) config: AppConfig) {
    super({ adapter: new PrismaPg(config.database.url) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
