import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express = require('express');
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

let cachedServer: express.Express | undefined;

async function bootstrapServer() {
  if (cachedServer) {
    return cachedServer;
  }

  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn', 'log'],
  });

  configureApp(app);
  await app.init();

  cachedServer = server;
  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrapServer();

  return server(req, res);
}
