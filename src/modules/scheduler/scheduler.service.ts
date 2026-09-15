import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import {
  Client,
  ClientSubscription,
  Location,
  SessionParticipant,
  SubscriptionType,
  WorkoutSession,
} from '@prisma/client';

type SessionWithDetails = WorkoutSession & {
  location: Location | null;
  participants: Array<
    SessionParticipant & {
      client: (Client & { subscriptions?: ClientSubscription[] }) | null;
    }
  >;
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
          include: {
            location: true,
            participants: {
              include: {
                client: {
                  include: {
                    subscriptions: {
                      where: { status: 'ACTIVE' },
                    },
                  },
                },
              },
            },
          },
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

  async checkSubscriptionExpirations(): Promise<void> {
    this.logger.log('Checking subscription expirations...');
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Auto-expire DATE_RANGE subscriptions past endDate
    await this.prisma.clientSubscription.updateMany({
      where: {
        status: 'ACTIVE',
        type: 'DATE_RANGE',
        endDate: { lte: now },
      },
      data: { status: 'EXPIRED' },
    });

    // Find subscriptions approaching expiration (not yet reminded)
    const expiringSubscriptions = await this.prisma.clientSubscription.findMany({
      where: {
        status: 'ACTIVE',
        reminderSent: false,
        OR: [
          // DATE_RANGE: endDate within 3 days
          {
            type: 'DATE_RANGE',
            endDate: { lte: threeDaysFromNow, gt: now },
          },
          // SESSIONS_BASED: 2 or fewer sessions remaining
          {
            type: 'SESSIONS_BASED',
            totalSessions: { not: null },
          },
        ],
      },
      include: {
        client: true,
        trainer: true,
      },
    });

    for (const sub of expiringSubscriptions) {
      const shouldRemind = this.shouldSendReminder(sub);
      if (!shouldRemind) continue;
      if (!sub.trainer.tgChatId) continue;

      const message = this.buildSubscriptionExpirationMessage(sub);
      await this.telegramService.sendMessage(sub.trainer.tgChatId, message);

      await this.prisma.clientSubscription.update({
        where: { id: sub.id },
        data: { reminderSent: true },
      });

      this.logger.log(`Sent expiration reminder for subscription ${sub.id}`);
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

      for (const p of session.participants) {
        const activeSub = p.client?.subscriptions?.[0];
        if (activeSub) {
          const isLastSession =
            activeSub.type === SubscriptionType.SESSIONS_BASED &&
            activeSub.totalSessions !== null &&
            activeSub.totalSessions - activeSub.usedSessions <= 1;

          if (isLastSession) {
            message += `⚠️ <i>Останнє заняття за абонементом клієнта ${p.client?.fullName}!</i>\n`;
          }
        }
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

  private shouldSendReminder(sub: ClientSubscription & { client: { fullName: string } }): boolean {
    if (sub.type === SubscriptionType.DATE_RANGE) {
      return true; // Already filtered by query (endDate within 3 days)
    }

    if (sub.type === SubscriptionType.SESSIONS_BASED && sub.totalSessions) {
      const remaining = sub.totalSessions - sub.usedSessions;
      return remaining <= 2;
    }

    return false;
  }

  private buildSubscriptionExpirationMessage(
    sub: ClientSubscription & { client: { fullName: string } },
  ): string {
    const clientName = sub.client.fullName;

    if (sub.type === SubscriptionType.DATE_RANGE && sub.endDate) {
      const endDateStr = sub.endDate.toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        timeZone: 'Europe/Kyiv',
      });
      return (
        `⚠️ <b>Абонемент закінчується!</b>\n\n` +
        `Клієнт: <b>${clientName}</b>\n` +
        `Тип: По датах\n` +
        `Закінчується: ${endDateStr}\n\n` +
        `💡 <i>Час запропонувати продовження!</i>`
      );
    }

    const remaining = (sub.totalSessions ?? 0) - sub.usedSessions;
    return (
      `⚠️ <b>Абонемент майже вичерпано!</b>\n\n` +
      `Клієнт: <b>${clientName}</b>\n` +
      `Тип: По кількості тренувань\n` +
      `Залишилось: ${remaining} з ${sub.totalSessions}\n\n` +
      `💡 <i>Час запропонувати продовження!</i>`
    );
  }
}
