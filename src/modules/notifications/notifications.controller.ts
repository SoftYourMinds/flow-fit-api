import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { WebPushService } from './web-push.service';
import { PushSubscriptionDto } from './dto/push-subscription.dto';
import type { AuthenticatedRequest } from '../../auth/interfaces/jwt-payload.interface';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly webPushService: WebPushService) {}

  @Get('vapid-key')
  @ApiOperation({ summary: 'Get VAPID public key for Web Push subscription' })
  getVapidKey() {
    return this.webPushService.getPublicKey();
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe device to web push notifications' })
  async subscribe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PushSubscriptionDto,
  ) {
    const record = await this.webPushService.subscribe(req.user.id, dto);
    return { success: true, subscriptionId: record.id };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe device endpoint' })
  async unsubscribe(@Body('endpoint') endpoint: string) {
    await this.webPushService.unsubscribe(endpoint);
    return { success: true };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('test')
  @ApiOperation({ summary: 'Send test notification to the current user' })
  async sendTest(@Req() req: AuthenticatedRequest) {
    const sent = await this.webPushService.sendToUser(req.user.id, {
      title: 'FlowFit 🔔',
      body: 'Тестове сповіщення успішно доставлено у PWA!',
    });
    return { success: true, sentCount: sent };
  }
}
