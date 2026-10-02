import { Body, Controller, Get, Headers, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppUpdatesService, BroadcastResult } from './app-updates.service';
import { AppReleaseUpdate } from './data/app-updates.data';
import { BroadcastUpdateDto } from './dto/broadcast-update.dto';

@ApiTags('App Updates')
@Controller('app-updates')
export class AppUpdatesController {
  constructor(private readonly appUpdatesService: AppUpdatesService) {}

  // ─── Public Methods ─────────────────────────────────────────────

  @Get('latest')
  @ApiOperation({ summary: 'Get latest application release update' })
  @ApiResponse({ status: 200, description: 'Latest release update data' })
  getLatest(): AppReleaseUpdate {
    return this.appUpdatesService.getLatestUpdate();
  }

  @Get()
  @ApiOperation({ summary: 'Get all application release updates history' })
  @ApiResponse({ status: 200, description: 'All release updates' })
  getAll(): AppReleaseUpdate[] {
    return this.appUpdatesService.getAllUpdates();
  }

  @Post('broadcast-telegram')
  @ApiOperation({ summary: 'Broadcast release update to all trainers in Telegram' })
  @ApiQuery({
    name: 'secret',
    required: false,
    description: 'Secret token or authorization header',
  })
  @ApiResponse({ status: 200, description: 'Broadcast delivery result' })
  async broadcastTelegram(
    @Body() dto: BroadcastUpdateDto,
    @Query('secret') querySecret?: string,
    @Headers('x-cron-secret') headerSecret?: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<BroadcastResult> {
    this.validateAccess(querySecret, headerSecret, authHeader);
    return this.appUpdatesService.broadcastTelegramUpdate(dto?.version);
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private validateAccess(querySecret?: string, headerSecret?: string, authHeader?: string): void {
    const expectedSecret = process.env.CRON_SECRET || 'flowfit-cron-secret-key';
    const providedSecret = querySecret || headerSecret;

    if (providedSecret === expectedSecret) {
      return;
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return;
    }

    throw new UnauthorizedException('Необхідна авторизація або валідний секретний ключ');
  }
}
