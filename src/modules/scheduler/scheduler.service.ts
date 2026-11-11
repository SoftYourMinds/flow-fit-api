import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { WebPushService } from '../notifications/web-push.service';
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
    private readonly webPushService: WebPushService,
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

  async sendWorkoutReminders(): Promise<void> {
    this.logger.log('Checking and dispatching workout session reminders...');
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        status: 'UPCOMING',
        enableNotification: true,
        reminderSentAt: null,
        startTime: {
          gte: now,
          lte: next24h,
        },
      },
      include: {
        location: true,
        trainer: true,
        participants: {
          include: { client: true },
        },
      },
    });

    for (const session of sessions) {
      const notifyAt = this.calcNotificationTime(session.startTime, session.reminderMode);
      if (!notifyAt || now < notifyAt) {
        continue;
      }

      const clientNames = session.participants
        .map((p) => p.customName || p.client?.fullName)
        .filter(Boolean)
        .join(', ');

      const timeStr = session.startTime.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Kyiv',
      });

      const locName = session.location?.name || 'Локація';
      const body = `О ${timeStr} — тренування на «${locName}»${clientNames ? ` (${clientNames})` : ''}`;

      // 1. Web Push (always dispatched for sessions with enabled notifications)
      const sentPushCount = await this.webPushService.sendToUser(session.trainerId, {
        title: session.isCritical ? '🚨 КРИТИЧНЕ: Тренування' : '🏋️ Нагадування про тренування',
        body,
        data: { sessionId: session.id, url: '/tabs/scheduler' },
      });

      // 2. Telegram (dispatched if session has critical flag and trainer connected telegram)
      let telegramDispatched = false;
      if (session.isCritical && session.trainer?.tgChatId) {
        await this.telegramService.sendMessage(
          session.trainer.tgChatId,
          `🚨 <b>КРИТИЧНЕ СПОВІЩЕННЯ ПРО ТРЕНУВАННЯ</b>\n\n${body}`,
        );
        telegramDispatched = true;
      }

      if (sentPushCount === 0 && !telegramDispatched) {
        this.logger.warn(
          `Skipped marking reminderSentAt for session #${session.id}: 0 push subscriptions succeeded and Telegram was not sent.`,
        );
        continue;
      }

      await this.prisma.workoutSession.update({
        where: { id: session.id },
        data: { reminderSentAt: now },
      });

      this.logger.log(
        `Dispatched reminder for session #${session.id} (push: ${sentPushCount}, telegram: ${telegramDispatched}, critical: ${session.isCritical})`,
      );
    }
  }

  private calcNotificationTime(sessionStart: Date, mode: string): Date | null {
    const now = new Date();
    const modeNum = parseInt(mode, 10);

    if (!isNaN(modeNum)) {
      return new Date(sessionStart.getTime() - modeNum * 60 * 1000);
    }

    const hour = this.getKyivHour(sessionStart);

    if (hour >= 7 && hour < 10) {
      const hoursUntil = (sessionStart.getTime() - now.getTime()) / 3600000;
      if (hoursUntil >= 12) {
        return this.buildKyivPreviousEvening(sessionStart);
      }
      return new Date(sessionStart.getTime() - 60 * 60 * 1000);
    }

    if (hour >= 10 && hour < 22) {
      return new Date(sessionStart.getTime() - 2 * 60 * 60 * 1000);
    }

    return new Date(sessionStart.getTime() - 60 * 60 * 1000);
  }

  private getKyivHour(date: Date): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Kyiv',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '0';
    return Number(hourPart) % 24;
  }

  private buildKyivPreviousEvening(sessionStart: Date): Date {
    const kyivDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(sessionStart);

    const [year, month, day] = kyivDateStr.split('-').map(Number);
    const prevDayUtc = new Date(Date.UTC(year, month - 1, day - 1, 20, 0, 0));
    const kyivHourAtGuess = this.getKyivHour(prevDayUtc);
    const offsetHours = kyivHourAtGuess - 20;

    return new Date(prevDayUtc.getTime() - offsetHours * 60 * 60 * 1000);
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
