import { SchedulerService } from './scheduler.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { WebPushService } from '../notifications/web-push.service';

describe('SchedulerService workout reminders', () => {
  let service: SchedulerService;
  let prisma: {
    workoutSession: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let telegramService: { sendMessage: jest.Mock };
  let webPushService: { sendToUser: jest.Mock };

  beforeEach(() => {
    prisma = {
      workoutSession: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    telegramService = { sendMessage: jest.fn().mockResolvedValue(undefined) };
    webPushService = { sendToUser: jest.fn().mockResolvedValue(0) };

    service = new SchedulerService(
      prisma as unknown as PrismaService,
      telegramService as unknown as TelegramService,
      webPushService as unknown as WebPushService,
    );
  });

  it('does not mark reminderSentAt when 0 pushes delivered and not critical', async () => {
    const startTime = new Date(Date.now() + 30 * 60 * 1000);
    prisma.workoutSession.findMany.mockResolvedValue([
      {
        id: 101,
        trainerId: 5,
        startTime,
        reminderMode: '60',
        isCritical: false,
        location: { name: 'Studio' },
        trainer: { tgChatId: null },
        participants: [],
      },
    ]);

    await service.sendWorkoutReminders();

    expect(webPushService.sendToUser).toHaveBeenCalledTimes(1);
    expect(prisma.workoutSession.update).not.toHaveBeenCalled();
  });

  it('marks reminderSentAt when push delivery succeeds', async () => {
    const startTime = new Date(Date.now() + 30 * 60 * 1000);
    webPushService.sendToUser.mockResolvedValue(1);
    prisma.workoutSession.findMany.mockResolvedValue([
      {
        id: 102,
        trainerId: 5,
        startTime,
        reminderMode: '60',
        isCritical: false,
        location: { name: 'Studio' },
        trainer: { tgChatId: null },
        participants: [],
      },
    ]);

    await service.sendWorkoutReminders();

    expect(prisma.workoutSession.update).toHaveBeenCalledTimes(1);
    const updateCall = prisma.workoutSession.update.mock.calls[0] as [
      { where: { id: number }; data: { reminderSentAt: Date } },
    ];
    expect(updateCall[0].where).toEqual({ id: 102 });
    expect(updateCall[0].data.reminderSentAt).toBeInstanceOf(Date);
  });

  it('computes 20:00 Europe/Kyiv previous evening accurately in UTC', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-14T10:00:00.000Z'));
    try {
      // 2026-07-15 08:00 Kyiv (UTC+3) = 2026-07-15T05:00:00Z -> previous evening 20:00 Kyiv = 2026-07-14T17:00:00Z
      const sessionStart = new Date('2026-07-15T05:00:00.000Z');
      const calcFn = (
        service as unknown as { calcNotificationTime: (s: Date, m: string) => Date | null }
      ).calcNotificationTime.bind(service);

      const notifyAt = calcFn(sessionStart, 'auto');
      expect(notifyAt?.toISOString()).toBe('2026-07-14T17:00:00.000Z');
    } finally {
      jest.useRealTimers();
    }
  });
});
