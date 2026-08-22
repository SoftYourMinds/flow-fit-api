import { Controller, Get, Query, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

export interface TriggerCronResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

@ApiTags('Scheduler')
@Controller('scheduler')
export class SchedulerController {
  private readonly logger = new Logger(SchedulerController.name);

  constructor(private readonly schedulerService: SchedulerService) {}

  // ─── Public Methods ─────────────────────────────────────────────

  @Get('trigger')
  @ApiOperation({ summary: 'Trigger scheduled tasks (intended for Vercel Cron or cron-job.org)' })
  @ApiQuery({
    name: 'secret',
    required: false,
    description: 'Secret key to authorize the execution',
  })
  async triggerCron(
    @Query('secret') querySecret?: string,
    @Headers('x-cron-secret') headerSecret?: string,
  ): Promise<TriggerCronResponse> {
    this.validateCronSecret(querySecret, headerSecret);

    this.logger.log('Cron triggered via HTTP endpoint');

    // 1. Update session statuses
    await this.schedulerService.handleSessionStatusUpdates();

    // 2. Dispatch digests based on Kyiv timezone
    await this.dispatchScheduledDigests();

    return {
      success: true,
      message: 'Scheduler task triggered successfully',
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private validateCronSecret(querySecret?: string, headerSecret?: string): void {
    const expectedSecret = process.env.CRON_SECRET || 'flowfit-cron-secret-key';
    const providedSecret = querySecret || headerSecret;

    if (providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret token');
    }
  }

  private async dispatchScheduledDigests(): Promise<void> {
    const kyivTimeStr = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' });
    const kyivDate = new Date(kyivTimeStr);
    const hour = kyivDate.getHours();
    const minute = kyivDate.getMinutes();

    const isMorningSlot = hour === 8 && minute < 10;
    if (isMorningSlot) {
      await this.schedulerService.sendMorningDigest();
    }

    const isEveningSlot = hour === 20 && minute < 10;
    if (isEveningSlot) {
      await this.schedulerService.sendEveningSummary();
    }
  }
}
