import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, SessionStatus } from '@prisma/client';

export interface GroupStatistics {
  totalClients: number;
  totalSessions: number;
  missedRate: number;
}

export interface ReportSummaryResponse {
  totalIncome: number;
  incomeBreakdown: {
    individual: number;
    group: number;
  };
  statistics: {
    all: GroupStatistics;
    individual: GroupStatistics;
    group: GroupStatistics;
  };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Public Methods ─────────────────────────────────────────────

  async getSummary(
    trainerId: number,
    startDate: string,
    endDate: string,
    locationId?: number,
    workoutTypes?: string[],
  ): Promise<ReportSummaryResponse> {
    const whereClause = this.buildWhereClause(
      trainerId,
      startDate,
      endDate,
      locationId,
      workoutTypes,
    );

    const sessions = await this.prisma.workoutSession.findMany({
      where: whereClause,
      include: {
        participants: true,
      },
    });

    return this.calculateSummaryMetrics(sessions);
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private buildWhereClause(
    trainerId: number,
    startDate: string,
    endDate: string,
    locationId?: number,
    workoutTypes?: string[],
  ): Prisma.WorkoutSessionWhereInput {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const whereClause: Prisma.WorkoutSessionWhereInput = {
      trainerId,
      startTime: {
        gte: start,
        lte: end,
      },
    };

    if (locationId) {
      whereClause.locationId = locationId;
    }

    if (workoutTypes && workoutTypes.length > 0) {
      whereClause.workoutTypes = {
        hasSome: workoutTypes,
      };
    }

    return whereClause;
  }

  private calculateSummaryMetrics(
    sessions: Array<{
      type: string;
      status: SessionStatus;
      isPaid: boolean;
      price: number | null;
      participants: Array<{ clientId: number | null }>;
    }>,
  ): ReportSummaryResponse {
    let totalIncome = 0;
    let individualIncome = 0;
    let groupIncome = 0;

    const totalSessionsCount = sessions.length;
    let individualSessionsCount = 0;
    let groupSessionsCount = 0;

    let missedSessionsCount = 0;
    let individualMissedCount = 0;
    let groupMissedCount = 0;

    const clientIds = new Set<number>();
    const individualClientIds = new Set<number>();
    const groupClientIds = new Set<number>();

    for (const session of sessions) {
      const isIndividual = session.type === 'INDIVIDUAL';
      const isGroup = session.type === 'GROUP';

      if (isIndividual) individualSessionsCount++;
      if (isGroup) groupSessionsCount++;

      if (session.status === SessionStatus.MISSED) {
        missedSessionsCount++;
        if (isIndividual) individualMissedCount++;
        if (isGroup) groupMissedCount++;
      }

      for (const p of session.participants) {
        if (p.clientId) {
          clientIds.add(p.clientId);
          if (isIndividual) individualClientIds.add(p.clientId);
          if (isGroup) groupClientIds.add(p.clientId);
        }
      }

      const isCountedIncome = session.status === SessionStatus.COMPLETED || session.isPaid;
      if (isCountedIncome) {
        const sessionIncome = session.price || 0;
        totalIncome += sessionIncome;

        if (isIndividual) {
          individualIncome += sessionIncome;
        } else if (isGroup) {
          groupIncome += sessionIncome;
        }
      }
    }

    return {
      totalIncome,
      incomeBreakdown: {
        individual: individualIncome,
        group: groupIncome,
      },
      statistics: {
        all: {
          totalClients: clientIds.size,
          totalSessions: totalSessionsCount,
          missedRate: this.calculateMissedRate(missedSessionsCount, totalSessionsCount),
        },
        individual: {
          totalClients: individualClientIds.size,
          totalSessions: individualSessionsCount,
          missedRate: this.calculateMissedRate(individualMissedCount, individualSessionsCount),
        },
        group: {
          totalClients: groupClientIds.size,
          totalSessions: groupSessionsCount,
          missedRate: this.calculateMissedRate(groupMissedCount, groupSessionsCount),
        },
      },
    };
  }

  private calculateMissedRate(missed: number, total: number): number {
    return total > 0 ? Math.round((missed / total) * 100) : 0;
  }
}
