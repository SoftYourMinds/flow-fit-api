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
          orderBy: { date: 'desc' },
          take: 1, // Get the latest metrics
        },
        participations: {
          where: {
            session: {
              startTime: { gte: new Date() } // Upcoming sessions
            }
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
          take: 5 // Next 5 upcoming sessions
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
      latestMetrics: client.metrics.length > 0 ? {
        weight: client.metrics[0].weight,
        bodyFatPercentage: client.metrics[0].bodyFatPercentage,
        chest: client.metrics[0].chest,
        waist: client.metrics[0].waist,
        belly: client.metrics[0].belly,
        legLeft: client.metrics[0].legLeft,
        legRight: client.metrics[0].legRight,
        armLeft: client.metrics[0].armLeft,
        armRight: client.metrics[0].armRight,
        date: client.metrics[0].date
      } : null,
      upcomingSessions: client.participations.map(p => ({
        id: p.session.id,
        startTime: p.session.startTime,
        endTime: p.session.endTime,
        locationName: p.session.location.name,
        type: p.session.type,
      }))
    };
  }
}
