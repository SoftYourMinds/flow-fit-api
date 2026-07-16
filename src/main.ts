import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loggerConfig } from './logger/logger.config';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const server = express();
let cachedApp: any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: loggerConfig,
  });
  app.enableCors({
    origin: true, // Allow any origin to pass
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  await app.init();
  return app;
}

if (process.env.NODE_ENV !== 'production') {
  bootstrap().then((app) => {
    app.listen(process.env.PORT ?? 3000);
  });
}

export default async function handler(req: any, res: any) {
  if (!cachedApp) {
    cachedApp = await bootstrap();
  }
  return server(req, res);
}
