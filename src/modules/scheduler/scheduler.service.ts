import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { Location, SessionParticipant, WorkoutSession } from '@prisma/client';

type SessionWithDetails = WorkoutSession & {
  location: Location | null;
  participants: Array<SessionParticipant & { client: { fullName: string } | null }>;
};

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  // ─── Public Methods ─────────────────────────────────────────────

  async handleSessionStatusUpdates(): Promise<void> {
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
        this.logger.log(
          `Updated ${upcomingToActiveResult.count} session(s) from UPCOMING to ACTIVE`,
        );
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
        this.logger.log(
          `Updated ${activeToCompletedResult.count} session(s) from ACTIVE to COMPLETED`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to update session statuses', error);
    }
  }

  async sendMorningDigest(): Promise<void> {
    this.logger.log('Sending morning digests...');
    const { startOfDay, endOfDay } = this.getTodayDateRange();

    const usersWithTelegram = await this.prisma.user.findMany({
      where: { tgChatId: { not: null } },
      include: {
        sessions: {
          where: {
            startTime: { gte: startOfDay, lte: endOfDay },
          },
          include: { location: true, participants: { include: { client: true } } },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    for (const user of usersWithTelegram) {
      if (!user.tgChatId) {
        continue;
      }

      const sessions = user.sessions as SessionWithDetails[];
      if (sessions.length === 0) {
        await this.telegramService.sendMessage(
          user.tgChatId,
          '🌅 <b>Доброго ранку!</b> На сьогодні у вас немає запланованих тренувань. Гарного дня для відпочинку!',
        );
        continue;
      }

      const message = this.buildMorningDigestMessage(sessions);
      await this.telegramService.sendMessage(user.tgChatId, message);
    }
  }

  async sendEveningSummary(): Promise<void> {
    this.logger.log('Sending evening summaries...');
    const { startOfDay, endOfDay } = this.getTodayDateRange();

    const usersWithTelegram = await this.prisma.user.findMany({
      where: { tgChatId: { not: null } },
      include: {
        sessions: {
          where: {
            startTime: { gte: startOfDay, lte: endOfDay },
          },
        },
      },
    });

    for (const user of usersWithTelegram) {
      if (!user.tgChatId) {
        continue;
      }

      const sessions = user.sessions;
      if (sessions.length === 0) {
        continue;
      }

      const message = this.buildEveningSummaryMessage(sessions);
      await this.telegramService.sendMessage(user.tgChatId, message);
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private getTodayDateRange(): { startOfDay: Date; endOfDay: Date } {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startOfDay, endOfDay };
  }

  private buildMorningDigestMessage(sessions: SessionWithDetails[]): string {
    let message = `🌅 <b>Доброго ранку!</b> Твій план тренувань на сьогодні:\n\n`;

    for (const session of sessions) {
      const time = session.startTime.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Kyiv',
      });
      const type = session.type === 'INDIVIDUAL' ? 'Персональне' : 'Спліт/Групове';

      const participantNames = session.participants
        .map((p) => p.customName || p.client?.fullName)
        .filter(Boolean);
      const clientNames =
        participantNames.length > 0 ? participantNames.join(', ') : 'Без учасників';

      message += `🕙 <b>${time}</b> — ${type} (${clientNames})\n`;
      if (session.location) {
        message += `📍 Локація: ${session.location.name}\n`;
      }
      message += `\n`;
    }

    message += `💡 <i>Гарного продуктивного дня!</i>`;
    return message;
  }

  private buildEveningSummaryMessage(sessions: WorkoutSession[]): string {
    const completed = sessions.filter((s) => s.status === 'COMPLETED').length;
    const total = sessions.length;

    let message = `🌙 <b>Чудова робота сьогодні!</b>\n\n`;
    message += `✅ Проведено ${completed} з ${total} запланованих тренувань.\n\n`;

    const allCompleted = completed === total;
    if (allCompleted) {
      message += `🏆 Відмінний результат! Усі тренування виконані.\n`;
    }

    message += `\nВідпочивай та відновлюйся 😴`;
    return message;
  }
}
