import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import * as process from 'process';

@Module({
  imports: [
    PrismaModule,
    TelegrafModule.forRootAsync({
      useFactory: () => ({
        token: process.env.TELEGRAM_BOT_TOKEN || 'dummy_token',
        launchOptions: process.env.NODE_ENV === 'production' ? false : undefined,
      }),
    }),
  ],
  providers: [TelegramService],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule {}
