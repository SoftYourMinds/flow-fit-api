import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionQueryDto } from './dto/session-query.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(trainerId: number, dto: CreateSessionDto) {
    return this.prisma.workoutSession.create({
      data: {
        trainerId,
        locationId: dto.locationId,
        type: dto.type,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        pricePerPerson: dto.pricePerPerson,
        status: dto.status,
      },
      include: {
        location: true,
        participants: { include: { client: true } },
      },
    });
  }

  async findAll(trainerId: number, query: SessionQueryDto) {
    const where: any = { trainerId };

    if (query.start && query.end) {
      where.startTime = {
        gte: new Date(query.start),
        lte: new Date(query.end),
      };
    } else if (query.start) {
      where.startTime = { gte: new Date(query.start) };
    } else if (query.end) {
      where.startTime = { lte: new Date(query.end) };
    }

    if (query.locationId) where.locationId = query.locationId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    
    if (query.clientId) {
      where.participants = {
        some: { clientId: query.clientId },
      };
    }

    const sessions = await this.prisma.workoutSession.findMany({
      where,
      include: {
        location: true,
        participants: { include: { client: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    return sessions.map((s) => ({
      ...s,
      totalPrice: s.pricePerPerson * s.participants.length,
    }));
  }

  async findOne(trainerId: number, id: number) {
    const session = await this.prisma.workoutSession.findUnique({
      where: { id },
      include: {
        location: true,
        participants: { include: { client: true } },
      },
    });

    if (!session || session.trainerId !== trainerId) {
      throw new NotFoundException('Workout session not found');
    }

    return {
      ...session,
      totalPrice: session.pricePerPerson * session.participants.length,
    };
  }

  async update(trainerId: number, id: number, dto: UpdateSessionDto) {
    await this.findOne(trainerId, id); // Verify ownership

    const data: any = { ...dto };
    if (dto.startTime) data.startTime = new Date(dto.startTime);
    if (dto.endTime) data.endTime = new Date(dto.endTime);

    return this.prisma.workoutSession.update({
      where: { id },
      data,
      include: {
        location: true,
        participants: { include: { client: true } },
      },
    });
  }

  async remove(trainerId: number, id: number) {
    await this.findOne(trainerId, id); // Verify ownership

    return this.prisma.workoutSession.delete({
      where: { id },
    });
  }

  async addParticipant(trainerId: number, sessionId: number, dto: AddParticipantDto) {
    await this.findOne(trainerId, sessionId); // Verify ownership

    return this.prisma.sessionParticipant.create({
      data: {
        sessionId,
        clientId: dto.clientId,
        customName: dto.customName,
      },
      include: { client: true },
    });
  }

  async removeParticipant(trainerId: number, sessionId: number, participantId: number) {
    await this.findOne(trainerId, sessionId); // Verify ownership

    return this.prisma.sessionParticipant.delete({
      where: { id: participantId },
    });
  }

  async duplicateWeek(trainerId: number, sourceStart: string, targetStart: string) {
    const sourceStartDate = new Date(sourceStart);
    const sourceEndDate = new Date(sourceStartDate);
    sourceEndDate.setDate(sourceEndDate.getDate() + 7);

    const targetStartDate = new Date(targetStart);
    const diffMs = targetStartDate.getTime() - sourceStartDate.getTime();

    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        trainerId,
        startTime: {
          gte: sourceStartDate,
          lt: sourceEndDate,
        },
      },
      include: { participants: true },
    });

    const createdSessions = [];

    for (const session of sessions) {
      const newStartTime = new Date(session.startTime.getTime() + diffMs);
      const newEndTime = new Date(session.endTime.getTime() + diffMs);

      const newSession = await this.prisma.workoutSession.create({
        data: {
          trainerId: session.trainerId,
          locationId: session.locationId,
          type: session.type,
          pricePerPerson: session.pricePerPerson,
          status: 'UPCOMING',
          startTime: newStartTime,
          endTime: newEndTime,
          participants: {
            create: session.participants.map(p => ({
              clientId: p.clientId,
              customName: p.customName,
            })),
          },
        },
        include: { participants: true },
      });
      createdSessions.push(newSession);
    }

    return createdSessions;
  }
}
