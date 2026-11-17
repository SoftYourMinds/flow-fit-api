import { ServiceUnavailableException } from '@nestjs/common';

import * as webPush from 'web-push';

import { PrismaService } from '../../prisma/prisma.service';
import { WebPushService } from './web-push.service';

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

  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      VAPID_PUBLIC_KEY: 'test-vapid-public-key',
      VAPID_PRIVATE_KEY: 'test-vapid-private-key',
      VAPID_SUBJECT: 'mailto:test@flowfit.app',
    };

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

  afterEach(() => {
    process.env = originalEnv;
  });

  it('configures VAPID details from environment variables', () => {
    expect(webPush.setVapidDetails).toHaveBeenCalledWith(
      'mailto:test@flowfit.app',
      'test-vapid-public-key',
      'test-vapid-private-key',
    );
    expect(service.getPublicKey()).toEqual({ publicKey: 'test-vapid-public-key' });
  });

  it('throws ServiceUnavailableException and skips sending when VAPID env vars are missing', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    const unconfiguredService = new WebPushService(prisma as unknown as PrismaService);

    expect(() => unconfiguredService.getPublicKey()).toThrow(ServiceUnavailableException);

    const result = await unconfiguredService.sendToUserDetailed(1, {
      title: 'FlowFit',
      body: 'Test body',
    });

    expect(result).toEqual({
      totalSubscriptions: 0,
      sentCount: 0,
      failedCount: 0,
      errors: ['VAPID keys are not configured on server.'],
    });
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
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
