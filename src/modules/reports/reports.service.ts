import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(trainerId: number, startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        trainerId,
        startTime: {
          gte: start,
          lte: end,
        },
      },
      include: {
        participants: true,
      },
    });

    let totalIncome = 0;
    let individualIncome = 0;
    let groupIncome = 0;
    
    let totalSessionsCount = sessions.length;
    let missedSessionsCount = 0;
    
    const clientIds = new Set<number>();

    for (const session of sessions) {
      if (session.status === SessionStatus.MISSED) {
        missedSessionsCount++;
      }

      if (session.status === SessionStatus.COMPLETED) {
        const sessionIncome = session.pricePerPerson * session.participants.length;
        totalIncome += sessionIncome;
        
        if (session.type === 'INDIVIDUAL') {
          individualIncome += sessionIncome;
        } else if (session.type === 'GROUP') {
          groupIncome += sessionIncome;
        }

        for (const p of session.participants) {
          if (p.clientId) {
            clientIds.add(p.clientId);
          }
        }
      }
    }

    const missedRate = totalSessionsCount > 0 
      ? Math.round((missedSessionsCount / totalSessionsCount) * 100) 
      : 0;

    return {
      totalIncome,
      incomeBreakdown: {
        individual: individualIncome,
        group: groupIncome,
      },
      statistics: {
        totalClients: clientIds.size,
        totalSessions: totalSessionsCount,
        missedRate,
      }
    };
  }
}
