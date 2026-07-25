import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getClientByShareToken(token: string) {
    const client = await this.prisma.client.findUnique({
      where: { shareToken: token },
      include: {
        trainer: {
          select: {
            firstName: true,
            lastName: true,
          }
        },
        metrics: {
          orderBy: { date: 'asc' }, // Get all metrics for chart, ascending order
        },
        participations: {
          where: {
            // Include both past and future for the calendar, maybe restrict to attended or upcoming
            OR: [
              { isAttended: true },
              { session: { startTime: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } } // At least from last 30 days
            ]
          },
          include: {
            session: {
              include: {
                location: true,
              }
            }
          },
          orderBy: {
            session: {
              startTime: 'asc'
            }
          },
        }
      }
    });

    if (!client || !client.isActive) {
      throw new NotFoundException('Client profile not found or is inactive.');
    }

    // Return only the public-facing data
    return {
      fullName: client.fullName,
      goal: client.goal,
      currentWeight: client.currentWeight,
      trainerName: `${client.trainer.firstName} ${client.trainer.lastName}`,
      metrics: client.metrics.map(m => ({
        weight: m.weight,
        bodyFatPercentage: m.bodyFatPercentage,
        chest: m.chest,
        waist: m.waist,
        belly: m.belly,
        legLeft: m.legLeft,
        legRight: m.legRight,
        armLeft: m.armLeft,
        armRight: m.armRight,
        date: m.date
      })),
      sessions: client.participations.map(p => ({
        id: p.session.id,
        startTime: p.session.startTime,
        endTime: p.session.endTime,
        locationName: p.session.location.name,
        type: p.session.type,
        isAttended: p.isAttended,
        status: p.session.status
      }))
    };
  }
}
