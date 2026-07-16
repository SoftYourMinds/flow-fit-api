import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(trainerId: number, startDate: string, endDate: string, locationId?: number) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const whereClause: any = {
      trainerId,
      startTime: {
        gte: start,
        lte: end,
      },
    };

    if (locationId) {
      whereClause.locationId = locationId;
    }

    const sessions = await this.prisma.workoutSession.findMany({
      where: whereClause,
      include: {
        participants: true,
      },
    });

    let totalIncome = 0;
    let individualIncome = 0;
    let groupIncome = 0;
    
    let totalSessionsCount = sessions.length;
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

      if (session.status === SessionStatus.COMPLETED || session.isPaid) {
        const sessionIncome = session.price || 0;
        totalIncome += sessionIncome;
        
        if (isIndividual) {
          individualIncome += sessionIncome;
        } else if (isGroup) {
          groupIncome += sessionIncome;
        }
      }
    }

    const calculateRate = (missed: number, total: number) => total > 0 ? Math.round((missed / total) * 100) : 0;

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
          missedRate: calculateRate(missedSessionsCount, totalSessionsCount),
        },
        individual: {
          totalClients: individualClientIds.size,
          totalSessions: individualSessionsCount,
          missedRate: calculateRate(individualMissedCount, individualSessionsCount),
        },
        group: {
          totalClients: groupClientIds.size,
          totalSessions: groupSessionsCount,
          missedRate: calculateRate(groupMissedCount, groupSessionsCount),
        }
      }
    };
  }
}
