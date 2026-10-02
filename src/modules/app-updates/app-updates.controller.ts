import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Broadcast release update to all trainers in Telegram' })
  @ApiResponse({ status: 200, description: 'Broadcast delivery result' })
  broadcastTelegram(@Body() dto: BroadcastUpdateDto): Promise<BroadcastResult> {
    return this.appUpdatesService.broadcastTelegramUpdate(dto.version);
  }
}
