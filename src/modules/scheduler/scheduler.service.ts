import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService
  ) {}

  async handleSessionStatusUpdates() {
    const now = new Date();

    try {
      // 1. UPCOMING -> ACTIVE
      const upcomingToActiveResult = await this.prisma.workoutSession.updateMany({
        where: {
          status: 'UPCOMING',
          startTime: { lte: now },
        },
        data: { status: 'ACTIVE' },
      });

      if (upcomingToActiveResult.count > 0) {
        this.logger.log(`Updated ${upcomingToActiveResult.count} session(s) from UPCOMING to ACTIVE`);
      }

      // 2. ACTIVE -> COMPLETED
      const activeToCompletedResult = await this.prisma.workoutSession.updateMany({
        where: {
          status: 'ACTIVE',
          endTime: { lte: now },
        },
        data: { status: 'COMPLETED' },
      });

      if (activeToCompletedResult.count > 0) {
        this.logger.log(`Updated ${activeToCompletedResult.count} session(s) from ACTIVE to COMPLETED`);
      }
    } catch (error) {
      this.logger.error('Failed to update session statuses', error);
    }
  }

  async sendMorningDigest() {
    this.logger.log('Sending morning digests...');
    const now = new Date();
    
    // Get start and end of today
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const usersWithTelegram = await this.prisma.user.findMany({
      where: { tgChatId: { not: null } },
      include: {
        sessions: {
          where: {
            startTime: { gte: startOfDay, lte: endOfDay }
          },
          include: { location: true, participants: { include: { client: true } } },
          orderBy: { startTime: 'asc' }
        }
      }
    });

    for (const user of usersWithTelegram) {
      if (!user.tgChatId) continue;
      
      const sessions = user.sessions;
      if (sessions.length === 0) {
        await this.telegramService.sendMessage(user.tgChatId, '🌅 <b>Доброго ранку!</b> На сьогодні у вас немає запланованих тренувань. Гарного дня для відпочинку!');
        continue;
      }

      let message = `🌅 <b>Доброго ранку!</b> Твій план тренувань на сьогодні:\n\n`;
      
      sessions.forEach(session => {
        const time = session.startTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
        const type = session.type === 'INDIVIDUAL' ? 'Персональне' : 'Спліт/Групове';
        
        let clientNames = session.participants.map(p => p.customName || p.client?.fullName).filter(Boolean).join(', ');
        if (!clientNames) clientNames = 'Без учасників';

        message += `🕙 <b>${time}</b> — ${type} (${clientNames})\n`;
        if (session.location) {
          message += `📍 Локація: ${session.location.name}\n`;
        }
        message += `\n`;
      });

      message += `💡 <i>Гарного продуктивного дня!</i>`;

      await this.telegramService.sendMessage(user.tgChatId, message);
    }
  }

  async sendEveningSummary() {
    this.logger.log('Sending evening summaries...');
    const now = new Date();
    
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const usersWithTelegram = await this.prisma.user.findMany({
      where: { tgChatId: { not: null } },
      include: {
        sessions: {
          where: {
            startTime: { gte: startOfDay, lte: endOfDay }
          }
        }
      }
    });

    for (const user of usersWithTelegram) {
      if (!user.tgChatId) continue;
      
      const sessions = user.sessions;
      if (sessions.length === 0) continue; // Don't bother if no sessions were planned

      const completed = sessions.filter(s => s.status === 'COMPLETED').length;
      const total = sessions.length;

      let message = `🌙 <b>Чудова робота сьогодні!</b>\n\n`;
      message += `✅ Проведено ${completed} з ${total} запланованих тренувань.\n\n`;
      
      if (completed === total) {
        message += `🏆 Відмінний результат! Усі тренування виконані.\n`;
      }
      
      message += `\nВідпочивай та відновлюйся 😴`;

      await this.telegramService.sendMessage(user.tgChatId, message);
    }
  }
}
