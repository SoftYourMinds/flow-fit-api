import { Injectable, Logger } from '@nestjs/common';
import * as webPush from 'web-push';
import { PrismaService } from '../../prisma/prisma.service';
import { PushSubscriptionDto } from './dto/push-subscription.dto';

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);

  constructor(private readonly prisma: PrismaService) {
    const publicKey =
      process.env.VAPID_PUBLIC_KEY ||
      'BFDEjZfejbXkWd8LO0SF5wO-YSld4Dj6Pc-oISzfoizPoHEm1-HK_YKi8GMTVyZebj20L3VGhb8udBPpb_ZBW3E';
    const privateKey =
      process.env.VAPID_PRIVATE_KEY || 'AP3FlKcSa6TAKI5CjTo8hwqt-TYWYvli1GXVr2cZXDw';
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@flowfit.app';

    try {
      const wp = (webPush as any).default || webPush;
      if (typeof wp.setVapidDetails === 'function') {
        wp.setVapidDetails(subject, publicKey, privateKey);
        this.logger.log('VAPID details configured successfully.');
      } else {
        this.logger.warn('webPush.setVapidDetails is not available');
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error('Failed to configure VAPID details', error.stack);
    }
  }

  getPublicKey(): { publicKey: string } {
    const publicKey =
      process.env.VAPID_PUBLIC_KEY ||
      'BFDEjZfejbXkWd8LO0SF5wO-YSld4Dj6Pc-oISzfoizPoHEm1-HK_YKi8GMTVyZebj20L3VGhb8udBPpb_ZBW3E';
    return { publicKey };
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

  async unsubscribe(endpoint: string) {
    try {
      await this.prisma.pushSubscription.deleteMany({
        where: { endpoint },
      });
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(`Could not unsubscribe endpoint: ${error.message}`);
    }
  }

  async sendToUser(
    userId: number,
    payload: { title: string; body: string; data?: Record<string, unknown>; icon?: string },
  ): Promise<number> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      this.logger.debug(`No push subscriptions found for user ${userId}`);
      return 0;
    }

    const notificationPayload = JSON.stringify({
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/favicon.ico',
        badge: '/favicon.ico',
        data: payload.data || { url: '/tabs/scheduler' },
      },
    });

    let successCount = 0;
    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        const wp = (webPush as any).default || webPush;
        await wp.sendNotification(pushSubscription, notificationPayload);
        successCount++;
      } catch (err: unknown) {
        const error = err as { statusCode?: number; message?: string };
        if (error.statusCode === 404 || error.statusCode === 410) {
          this.logger.log(`Subscription expired/gone for user ${userId}, removing: ${sub.id}`);
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          this.logger.error(`Error sending push notification to user ${userId}: ${error.message}`);
        }
      }
    });

    await Promise.allSettled(sendPromises);
    return successCount;
  }
}
