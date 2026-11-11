import { WebPushService } from './web-push.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as webPush from 'web-push';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('WebPushService', () => {
  let service: WebPushService;
  let prisma: {
    pushSubscription: {
      count: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      pushSubscription: {
        count: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn(),
      },
    };
    service = new WebPushService(prisma as unknown as PrismaService);
  });

  it('sends PNG icon/badge and onActionClick in Angular NGSW format', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([
      {
        id: 10,
        userId: 1,
        endpoint: 'https://web.push.apple.com/test',
        p256dh: 'key',
        auth: 'auth',
      },
    ]);
    (webPush.sendNotification as jest.Mock).mockResolvedValue({});

    const result = await service.sendToUserDetailed(1, {
      title: 'FlowFit',
      body: 'Test body',
      data: { url: '/tabs/settings' },
    });

    expect(result).toEqual({
      totalSubscriptions: 1,
      sentCount: 1,
      failedCount: 0,
      errors: [],
    });

    const sendMock = webPush.sendNotification as jest.Mock;
    const firstCallArgs = sendMock.mock.calls[0] as [unknown, string];
    const payloadRaw = firstCallArgs[1];
    const parsed = JSON.parse(payloadRaw) as {
      notification: {
        icon: string;
        badge: string;
        data: { onActionClick: { default: { operation: string; url: string } } };
      };
    };

    expect(parsed.notification.icon).toBe('/assets/icons/icon-192x192.png');
    expect(parsed.notification.badge).toBe('/assets/icons/icon-72x72.png');
    expect(parsed.notification.data.onActionClick.default).toEqual({
      operation: 'navigateLastFocusedOrOpen',
      url: '/tabs/settings',
    });
  });

  it('removes expired 410 subscriptions and surfaces error details', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([
      {
        id: 22,
        userId: 1,
        endpoint: 'https://web.push.apple.com/expired',
        p256dh: 'key',
        auth: 'auth',
      },
    ]);
    (webPush.sendNotification as jest.Mock).mockRejectedValue({
      statusCode: 410,
      message: 'Gone',
    });

    const result = await service.sendToUserDetailed(1, {
      title: 'FlowFit',
      body: 'Test',
    });

    expect(result.sentCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 22 } });
  });

  it('scopes unsubscribe by userId and endpoint', async () => {
    await service.unsubscribe(7, 'https://web.push.apple.com/sub1');

    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: 7, endpoint: 'https://web.push.apple.com/sub1' },
    });
  });
});
