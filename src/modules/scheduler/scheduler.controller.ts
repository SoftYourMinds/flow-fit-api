import { Controller, Get, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Get('trigger')
  async triggerCron(
    @Query('secret') querySecret?: string,
    @Headers('x-cron-secret') headerSecret?: string,
  ) {
    const expectedSecret = process.env.CRON_SECRET || 'flowfit-cron-secret-key';
    const providedSecret = querySecret || headerSecret;

    if (providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret token');
    }

    await this.schedulerService.handleSessionStatusUpdates();

    return {
      success: true,
      message: 'Scheduler task triggered successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
