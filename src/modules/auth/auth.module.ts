/**
 * Registers authentication/account HTTP handlers and the AuthService use cases.
 * Binds AuthRepository to its Prisma adapter and composes shared authentication infrastructure.
 */
import { AuthRepository } from './application/repositories/auth.repository.js';
import { PrismaAuthRepository } from './infrastructure/prisma-auth.repository.js';
import { JwtAuthCredentialsAdapter } from './infrastructure/jwt-auth-credentials.adapter.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module.js';
import { AuthController } from './presentation/auth.controller.js';
import { AccountController } from './presentation/account.controller.js';
import { AuthService } from './application/auth.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AuthController, AccountController],
  providers: [
    { provide: AuthRepository, useClass: PrismaAuthRepository },
    JwtAuthCredentialsAdapter,
    {
      provide: AuthService,
      inject: [AuthRepository, JwtAuthCredentialsAdapter],
      useFactory: (repository: AuthRepository, credentials: JwtAuthCredentialsAdapter) =>
        new AuthService(repository, credentials),
    },
  ],
})
export class AuthApiModule {}
