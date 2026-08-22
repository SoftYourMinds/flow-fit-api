import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.ms(),
      winston.format.colorize(),
      winston.format.printf((info) => {
        const timestamp = typeof info['timestamp'] === 'string' ? info['timestamp'] : '';
        const level = typeof info.level === 'string' ? info.level : '';
        const context = typeof info['context'] === 'string' ? `[${info['context']}] ` : '';
        const message =
          typeof info.message === 'string' ? info.message : JSON.stringify(info.message);
        const ms = typeof info['ms'] === 'string' ? info['ms'] : '';
        return `${timestamp} [${level}] ${context}${message} ${ms}`;
      }),
    ),
  }),
];

if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
    new DailyRotateFile({
      level: 'error',
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
  );
}

export const loggerConfig = WinstonModule.createLogger({
  transports,
});
