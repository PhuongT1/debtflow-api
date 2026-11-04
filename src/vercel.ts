import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import type { Request, Response } from 'express';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

let serverPromise: Promise<express.Express> | undefined;

async function bootstrapServer() {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn', 'log'],
    abortOnError: false,
  });

  configureApp(app);
  await app.init();

  return server;
}

export default async function handler(req: Request, res: Response) {
  // Concurrent cold-start requests share initialization; a failed attempt may retry.
  serverPromise ??= bootstrapServer().catch((error: unknown) => {
    serverPromise = undefined;
    throw error;
  });
  const server = await serverPromise;

  return server(req, res);
}
