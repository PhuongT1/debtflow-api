/**
 * Registers authentication/account HTTP handlers and the AuthService use cases.
 * Binds AuthRepository to its Prisma adapter and composes shared authentication infrastructure.
 */
import { AuthRepository } from './repositories/auth.repository.js';
import { PrismaAuthRepository } from './infrastructure/prisma-auth.repository.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module.js';
import { AuthController } from './controllers/auth.controller.js';
import { AccountController } from './controllers/account.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AuthController, AccountController],
  providers: [AuthService, { provide: AuthRepository, useClass: PrismaAuthRepository }],
})
export class AuthApiModule {}
