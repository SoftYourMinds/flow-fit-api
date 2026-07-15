import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { loggerConfig } from '../src/logger/logger.config';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';

const server = express.default ? express.default() : (express as any)();
let cachedServer: any;

async function bootstrap(expressInstance: express.Express) {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
    {
      logger: loggerConfig,
    },
  );
  app.enableCors();
  await app.init();
  return app;
}

export default async (req: any, res: any) => {
  if (!cachedServer) {
    cachedServer = await bootstrap(server);
  }
  server(req, res);
};
