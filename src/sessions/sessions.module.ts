import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../modules/telegram/telegram.module';

@Module({
  imports: [PrismaModule, TelegramModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
