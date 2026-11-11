import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { WebPushService, PushSendResult } from './web-push.service';
import { PushSubscriptionDto } from './dto/push-subscription.dto';
import type { AuthenticatedRequest } from '../../auth/interfaces/jwt-payload.interface';

export interface TestPushResponse extends PushSendResult {
  success: boolean;
}

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly webPushService: WebPushService) {}

  @Get('vapid-key')
  @ApiOperation({ summary: 'Get VAPID public key for Web Push subscription' })
  @ApiResponse({ status: 200, description: 'Public VAPID key returned successfully' })
  getVapidKey(): { publicKey: string } {
    return this.webPushService.getPublicKey();
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('status')
  @ApiOperation({ summary: 'Get active push subscription count for current user' })
  @ApiResponse({ status: 200, description: 'Subscription status returned successfully' })
  async getStatus(@Req() req: AuthenticatedRequest): Promise<{ subscriptionCount: number }> {
    const subscriptionCount = await this.webPushService.getSubscriptionCount(req.user.id);
    return { subscriptionCount };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe device to web push notifications' })
  @ApiResponse({ status: 201, description: 'Push subscription saved successfully' })
  async subscribe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PushSubscriptionDto,
  ): Promise<{ success: boolean; subscriptionId: number }> {
    const record = await this.webPushService.subscribe(req.user.id, dto);
    return { success: true, subscriptionId: record.id };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe device endpoint' })
  @ApiResponse({ status: 201, description: 'Push subscription removed successfully' })
  async unsubscribe(
    @Req() req: AuthenticatedRequest,
    @Body('endpoint') endpoint: string,
  ): Promise<{ success: boolean }> {
    await this.webPushService.unsubscribe(req.user.id, endpoint);
    return { success: true };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('test')
  @ApiOperation({ summary: 'Send test notification to the current user' })
  @ApiResponse({ status: 201, description: 'Test push notification dispatch result' })
  async sendTest(@Req() req: AuthenticatedRequest): Promise<TestPushResponse> {
    const result = await this.webPushService.sendToUserDetailed(req.user.id, {
      title: 'FlowFit 🔔',
      body: 'Тестове сповіщення успішно доставлено у PWA!',
      data: { url: '/tabs/settings' },
    });
    return {
      success: result.sentCount > 0,
      ...result,
    };
  }
}
