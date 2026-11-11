import { Injectable, Logger } from '@nestjs/common';

import * as webPush from 'web-push';

import { PrismaService } from '../../prisma/prisma.service';
import { PushSubscriptionDto } from './dto/push-subscription.dto';

type WebPushClient = typeof webPush & { default?: typeof webPush };

export interface PushSendPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  icon?: string;
}

export interface PushSendResult {
  totalSubscriptions: number;
  sentCount: number;
  failedCount: number;
  errors: string[];
}

interface StoredPushSubscription {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function getWebPushClient(): typeof webPush {
  const mod = webPush as WebPushClient;
  return mod.default ?? mod;
}

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private readonly defaultPublicKey =
    'BFDEjZfejbXkWd8LO0SF5wO-YSld4Dj6Pc-oISzfoizPoHEm1-HK_YKi8GMTVyZebj20L3VGhb8udBPpb_ZBW3E';
  private readonly defaultPrivateKey = 'AP3FlKcSa6TAKI5CjTo8hwqt-TYWYvli1GXVr2cZXDw';

  constructor(private readonly prisma: PrismaService) {
    this.configureVapidDetails();
  }

  // ─── Public Methods ─────────────────────────────────────────────

  getPublicKey(): { publicKey: string } {
    const publicKey = process.env.VAPID_PUBLIC_KEY || this.defaultPublicKey;
    return { publicKey };
  }

  async getSubscriptionCount(userId: number): Promise<number> {
    return this.prisma.pushSubscription.count({
      where: { userId },
    });
  }

  async subscribe(userId: number, dto: PushSubscriptionDto) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });
  }

  async unsubscribe(userId: number, endpoint: string): Promise<void> {
    if (!endpoint) return;

    try {
      await this.prisma.pushSubscription.deleteMany({
        where: { userId, endpoint },
      });
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(`Could not unsubscribe endpoint: ${error.message}`);
    }
  }

  async sendToUser(userId: number, payload: PushSendPayload): Promise<number> {
    const result = await this.sendToUserDetailed(userId, payload);
    return result.sentCount;
  }

  async sendToUserDetailed(userId: number, payload: PushSendPayload): Promise<PushSendResult> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      this.logger.debug(`No push subscriptions found for user ${userId}`);
      return {
        totalSubscriptions: 0,
        sentCount: 0,
        failedCount: 0,
        errors: [],
      };
    }

    const notificationPayload = this.buildNotificationPayload(payload);
    const results = await Promise.all(
      subscriptions.map((sub) => this.sendToSubscription(userId, sub, notificationPayload)),
    );

    const errors = results.filter((errorMsg): errorMsg is string => errorMsg !== null);
    const sentCount = subscriptions.length - errors.length;

    return {
      totalSubscriptions: subscriptions.length,
      sentCount,
      failedCount: errors.length,
      errors,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private configureVapidDetails(): void {
    const publicKey = process.env.VAPID_PUBLIC_KEY || this.defaultPublicKey;
    const privateKey = process.env.VAPID_PRIVATE_KEY || this.defaultPrivateKey;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@flowfit.app';

    try {
      const wp = getWebPushClient();
      if (typeof wp.setVapidDetails !== 'function') {
        this.logger.warn('webPush.setVapidDetails is not available');
        return;
      }

      wp.setVapidDetails(subject, publicKey, privateKey);
      this.logger.log('VAPID details configured successfully.');
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error('Failed to configure VAPID details', error.stack);
    }
  }

  private buildNotificationPayload(payload: PushSendPayload): string {
    const targetUrl = typeof payload.data?.url === 'string' ? payload.data.url : '/tabs/scheduler';

    return JSON.stringify({
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        data: {
          ...(payload.data || {}),
          url: targetUrl,
          onActionClick: {
            default: {
              operation: 'navigateLastFocusedOrOpen',
              url: targetUrl,
            },
          },
        },
      },
    });
  }

  private async sendToSubscription(
    userId: number,
    sub: StoredPushSubscription,
    notificationPayload: string,
  ): Promise<string | null> {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      const wp = getWebPushClient();
      await wp.sendNotification(pushSubscription, notificationPayload);
      return null;
    } catch (err: unknown) {
      const error = err as { statusCode?: number; body?: string; message?: string };
      const isSubscriptionGone = error.statusCode === 404 || error.statusCode === 410;

      if (isSubscriptionGone) {
        this.logger.log(`Subscription expired/gone for user ${userId}, removing: ${sub.id}`);
        await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        return `Підписку #${sub.id} анульовано (${error.statusCode}) та видалено.`;
      }

      const detail = error.body || error.message || 'Unknown push delivery error';
      this.logger.error(
        `Error sending push notification to user ${userId} (sub #${sub.id}, status ${error.statusCode ?? 'N/A'}): ${detail}`,
      );
      return `HTTP ${error.statusCode ?? 'ERR'}: ${detail}`;
    }
  }
}
