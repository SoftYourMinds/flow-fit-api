import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionQueryDto } from './dto/session-query.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { CreateRecurringSessionsDto } from './dto/create-recurring-sessions.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../modules/telegram/telegram.service';
import { Prisma, SessionParticipant, WorkoutSession } from '@prisma/client';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  // ─── Public Methods ─────────────────────────────────────────────

  async create(trainerId: number, dto: CreateSessionDto): Promise<WorkoutSession> {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    await this.validateTimeSlot(trainerId, startTime, endTime);

    return this.prisma.workoutSession.create({
      data: {
        trainerId,
        locationId: dto.locationId,
        type: dto.type,
        startTime,
        endTime,
        price: dto.price,
        status: dto.status,
        isPaid: dto.status === 'COMPLETED' ? true : dto.isPaid || false,
        workoutTypes: dto.workoutTypes || [],
        maxParticipants: dto.maxParticipants,
      },
      include: {
        location: true,
        participants: { include: { client: true } },
      },
    });
  }

  async findAll(trainerId: number, query: SessionQueryDto): Promise<WorkoutSession[]> {
    const where = this.buildFindAllWhereClause(trainerId, query);

    return this.prisma.workoutSession.findMany({
      where,
      include: {
        location: true,
        participants: { include: { client: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(trainerId: number, id: number): Promise<WorkoutSession> {
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

    return session;
  }

  async update(trainerId: number, id: number, dto: UpdateSessionDto): Promise<WorkoutSession> {
    const existing = await this.findOne(trainerId, id); // Verify ownership

    const startTime = dto.startTime ? new Date(dto.startTime) : existing.startTime;
    const endTime = dto.endTime ? new Date(dto.endTime) : existing.endTime;

    if (dto.startTime || dto.endTime) {
      await this.validateTimeSlot(trainerId, startTime, endTime, id);
    }

    const data: Prisma.WorkoutSessionUpdateInput = {
      location: dto.locationId !== undefined ? { connect: { id: dto.locationId } } : undefined,
      type: dto.type,
      price: dto.price,
      status: dto.status,
      workoutTypes: dto.workoutTypes,
      maxParticipants: dto.maxParticipants,
    };

    if (dto.startTime) {
      data.startTime = startTime;
    }
    if (dto.endTime) {
      data.endTime = endTime;
    }

    // Auto mark as paid if completed
    if (dto.status === 'COMPLETED') {
      data.isPaid = true;
    } else if (dto.isPaid !== undefined) {
      data.isPaid = dto.isPaid;
    }

    const updatedSession = await this.prisma.workoutSession.update({
      where: { id },
      data,
      include: {
        location: true,
        participants: { include: { client: true } },
        trainer: true,
      },
    });

    // Telegram Notification logic
    const shouldNotifyTrainer = dto.status === 'COMPLETED' && updatedSession.trainer?.tgChatId;
    if (shouldNotifyTrainer && updatedSession.trainer?.tgChatId) {
      await this.telegramService.sendMessage(
        updatedSession.trainer.tgChatId,
        `💪 <b>Супер!</b> Ще одне тренування завершено! Ти тиснеш на максимум!`,
      );
    }

    return updatedSession;
  }

  async remove(trainerId: number, id: number): Promise<WorkoutSession> {
    await this.findOne(trainerId, id); // Verify ownership

    return this.prisma.workoutSession.delete({
      where: { id },
    });
  }

  async addParticipant(
    trainerId: number,
    sessionId: number,
    dto: AddParticipantDto,
  ): Promise<SessionParticipant> {
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

  async removeParticipant(
    trainerId: number,
    sessionId: number,
    participantId: number,
  ): Promise<SessionParticipant> {
    await this.findOne(trainerId, sessionId); // Verify ownership

    return this.prisma.sessionParticipant.delete({
      where: { id: participantId },
    });
  }

  async duplicateWeek(
    trainerId: number,
    sourceStart: string,
    targetStart: string,
  ): Promise<WorkoutSession[]> {
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

    const createdSessions: WorkoutSession[] = [];

    for (const session of sessions) {
      const newStartTime = new Date(session.startTime.getTime() + diffMs);
      const newEndTime = new Date(session.endTime.getTime() + diffMs);

      const newSession = await this.prisma.workoutSession.create({
        data: {
          trainerId: session.trainerId,
          locationId: session.locationId,
          type: session.type,
          price: session.price,
          status: 'UPCOMING',
          workoutTypes: session.workoutTypes || [],
          startTime: newStartTime,
          endTime: newEndTime,
          participants: {
            create: session.participants.map((p) => ({
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

  async previewRecurringSessions(
    trainerId: number,
    dto: CreateRecurringSessionsDto,
  ): Promise<{ date: string; startTime: string; endTime: string; hasConflict: boolean }[]> {
    const dates = this.generateRecurringDates(dto);
    const previews = [];

    for (const date of dates) {
      const { startTime, endTime } = this.buildSessionTimes(date, dto.startTime, dto.endTime);

      const conflict = await this.prisma.workoutSession.findFirst({
        where: {
          trainerId,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });

      previews.push({
        date: date.toISOString().split('T')[0],
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        hasConflict: !!conflict,
      });
    }

    return previews;
  }

  async createRecurringSessions(
    trainerId: number,
    dto: CreateRecurringSessionsDto,
  ): Promise<WorkoutSession[]> {
    const dates = this.generateRecurringDates(dto);
    const createdSessions: WorkoutSession[] = [];

    for (const date of dates) {
      const { startTime, endTime } = this.buildSessionTimes(date, dto.startTime, dto.endTime);

      const hasConflict = await this.prisma.workoutSession.findFirst({
        where: {
          trainerId,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });

      if (hasConflict) continue;

      const session = await this.prisma.workoutSession.create({
        data: {
          trainerId,
          locationId: dto.locationId,
          type: 'INDIVIDUAL',
          startTime,
          endTime,
          price: dto.price ?? 0,
          status: 'UPCOMING',
          workoutTypes: dto.workoutTypes || [],
          subscriptionId: dto.subscriptionId,
          participants: {
            create: { clientId: dto.clientId },
          },
        },
        include: {
          location: true,
          participants: { include: { client: true } },
        },
      });

      createdSessions.push(session);
    }

    return createdSessions;
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private buildFindAllWhereClause(
    trainerId: number,
    query: SessionQueryDto,
  ): Prisma.WorkoutSessionWhereInput {
    const where: Prisma.WorkoutSessionWhereInput = { trainerId };

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

    if (query.locationId) {
      where.locationId = Number(query.locationId);
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.status) {
      where.status = query.status;
    }

    if (query.clientId) {
      where.participants = {
        some: { clientId: Number(query.clientId) },
      };
    }

    return where;
  }

  private async validateTimeSlot(
    trainerId: number,
    startTime: Date,
    endTime: Date,
    excludeSessionId?: number,
  ): Promise<void> {
    if (startTime >= endTime) {
      throw new BadRequestException('Час завершення тренування має бути пізніше часу початку');
    }

    const conflictingSession = await this.prisma.workoutSession.findFirst({
      where: {
        trainerId,
        ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
        startTime: {
          lt: endTime,
        },
        endTime: {
          gt: startTime,
        },
      },
    });

    if (conflictingSession) {
      throw new ConflictException('На цей час вже створено інше тренування');
    }
  }

  private generateRecurringDates(dto: CreateRecurringSessionsDto): Date[] {
    const dates: Date[] = [];
    const from = new Date(dto.dateFrom);
    const to = new Date(dto.dateTo);
    const current = new Date(from);

    while (current <= to) {
      if (dto.daysOfWeek.includes(current.getDay())) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  private buildSessionTimes(
    date: Date,
    startTimeStr: string,
    endTimeStr: string,
  ): { startTime: Date; endTime: Date } {
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);

    const startTime = new Date(date);
    startTime.setHours(startH, startM, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endH, endM, 0, 0);

    return { startTime, endTime };
  }
}
