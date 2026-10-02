import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AppUpdatesController } from './app-updates.controller';
import { AppUpdatesService } from './app-updates.service';

@Module({
  imports: [PrismaModule, TelegramModule],
  controllers: [AppUpdatesController],
  providers: [AppUpdatesService],
  exports: [AppUpdatesService],
})
export class AppUpdatesModule {}
