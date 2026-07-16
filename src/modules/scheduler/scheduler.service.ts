import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleSessionStatusUpdates() {
    const now = new Date();

    try {
      // 1. UPCOMING -> ACTIVE
      // Find sessions where status is UPCOMING and startTime has been reached
      const upcomingToActiveResult = await this.prisma.workoutSession.updateMany({
        where: {
          status: 'UPCOMING',
          startTime: {
            lte: now,
          },
        },
        data: {
          status: 'ACTIVE',
        },
      });

      if (upcomingToActiveResult.count > 0) {
        this.logger.log(`Updated ${upcomingToActiveResult.count} session(s) from UPCOMING to ACTIVE`);
      }

      // 2. ACTIVE -> COMPLETED
      // Find sessions where status is ACTIVE and endTime has been reached
      const activeToCompletedResult = await this.prisma.workoutSession.updateMany({
        where: {
          status: 'ACTIVE',
          endTime: {
            lte: now,
          },
        },
        data: {
          status: 'COMPLETED',
        },
      });

      if (activeToCompletedResult.count > 0) {
        this.logger.log(`Updated ${activeToCompletedResult.count} session(s) from ACTIVE to COMPLETED`);
      }
    } catch (error) {
      this.logger.error('Failed to update session statuses', error);
    }
  }
}
