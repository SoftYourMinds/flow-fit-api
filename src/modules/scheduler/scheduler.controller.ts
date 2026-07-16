import { Controller, Get, Query, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Scheduler')
@Controller('scheduler')
export class SchedulerController {
  private readonly logger = new Logger(SchedulerController.name);

  constructor(private readonly schedulerService: SchedulerService) {}

  @Get('trigger')
  @ApiOperation({ summary: 'Trigger scheduled tasks (intended for Vercel Cron or cron-job.org)' })
  @ApiQuery({ name: 'secret', required: false, description: 'Secret key to authorize the execution' })
  async triggerCron(
    @Query('secret') querySecret?: string,
    @Headers('x-cron-secret') headerSecret?: string,
  ) {
    const expectedSecret = process.env.CRON_SECRET || 'flowfit-cron-secret-key';
    const providedSecret = querySecret || headerSecret;

    if (providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret token');
    }

    this.logger.log('Cron triggered via HTTP endpoint');

    // 1. Update session statuses
    await this.schedulerService.handleSessionStatusUpdates();

    // 2. Check if it's time for Morning Digest (~08:00) or Evening Summary (~20:00)
    // cron-job runs every 10 mins. We check if hour is 8/20 and minute is between 0-9.
    // Use UTC hours + 3 for Kyiv timezone (or whatever local timezone the server is running on).
    // Let's assume server is in UTC. Kyiv is UTC+2 or UTC+3. We will just use the server's local time for now,
    // assuming it's configured correctly, or we can force Kyiv timezone if necessary.
    const now = new Date();
    
    // Quick and dirty timezone adjustment assuming UTC server to UTC+3 (Kyiv Summer Time)
    // If the server is already locally UTC+3, this might offset too much.
    // Since it's a simple app, let's use standard getHours() which uses local server time.
    // If hosted on Vercel, local time is UTC.
    // So 8 AM Kyiv = 5 AM UTC. 20 PM Kyiv = 17 PM UTC.
    // To be safe, we calculate Kyiv time directly:
    const kyivTimeStr = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' });
    const kyivDate = new Date(kyivTimeStr);
    const hour = kyivDate.getHours();
    const minute = kyivDate.getMinutes();

    // If it's between 08:00 and 08:09 (Kyiv time)
    if (hour === 8 && minute < 10) {
      await this.schedulerService.sendMorningDigest();
    }

    // If it's between 20:00 and 20:09 (Kyiv time)
    if (hour === 20 && minute < 10) {
      await this.schedulerService.sendEveningSummary();
    }

    return {
      success: true,
      message: 'Scheduler task triggered successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
