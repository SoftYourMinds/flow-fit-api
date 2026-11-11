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
  try {
    if (!cachedServer) {
      cachedServer = await bootstrap(server);
    }
    return server(req, res);
  } catch (err: any) {
    console.error('SERVERLESS BOOTSTRAP ERROR:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: 'SERVERLESS_BOOTSTRAP_ERROR',
        name: err?.name,
        message: err?.message || String(err),
        stack: err?.stack,
      }),
    );
  }
};
