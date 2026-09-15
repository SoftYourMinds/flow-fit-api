import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loggerConfig } from './logger/logger.config';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Request, Response } from 'express';
import { INestApplication, ValidationPipe } from '@nestjs/common';

const server = express();
let cachedApp: INestApplication | undefined;

async function bootstrap(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: loggerConfig,
  });
  app.enableCors({
    origin: true, // Allow any origin to pass
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

if (process.env.NODE_ENV !== 'production') {
  void bootstrap().then(async (app) => {
    await app.listen(process.env.PORT ?? 3000);
  });
}

export default async function handler(req: Request, res: Response): Promise<unknown> {
  if (!cachedApp) {
    cachedApp = await bootstrap();
  }
  return server(req, res);
}
