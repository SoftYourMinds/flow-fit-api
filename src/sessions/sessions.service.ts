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
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Prisma, SessionParticipant, WorkoutSession } from '@prisma/client';
import {
  buildUtcSessionTimes,
  generateRecurringCalendarDates,
} from '../shared/utils/date-time.util';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly subscriptionsService: SubscriptionsService,
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
        anonymousParticipantsCount: dto.anonymousParticipantsCount ?? 0,
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
      anonymousParticipantsCount: dto.anonymousParticipantsCount,
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
    const session = await this.findOne(trainerId, id); // Verify ownership

    if (session.subscriptionId) {
      return this.prisma.$transaction(async (tx) => {
        const deleted = await tx.workoutSession.delete({
          where: { id },
        });

        await this.subscriptionsService.recalculateSubscriptionUsage(
          trainerId,
          session.subscriptionId!,
          tx,
        );

        return deleted;
      });
    }

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
    const dates = generateRecurringCalendarDates(dto.dateFrom, dto.dateTo, dto.daysOfWeek);
    if (dates.length === 0) {
      return [];
    }

    const candidateSlots = dates.map((dateItem) => ({
      dateStr: dateItem.dateStr,
      ...buildUtcSessionTimes(dateItem, dto.startTime, dto.endTime, dto.timezoneOffset),
    }));

    const rangeStart = new Date(Math.min(...candidateSlots.map((s) => s.startTime.getTime())));
    const rangeEnd = new Date(Math.max(...candidateSlots.map((s) => s.endTime.getTime())));

    const existingSessions = await this.prisma.workoutSession.findMany({
      where: {
        trainerId,
        startTime: { lt: rangeEnd },
        endTime: { gt: rangeStart },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    return candidateSlots.map((slot) => {
      const hasConflict = existingSessions.some(
        (existing) => existing.startTime < slot.endTime && existing.endTime > slot.startTime,
      );

      return {
        date: slot.dateStr,
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
        hasConflict,
      };
    });
  }

  async createRecurringSessions(
    trainerId: number,
    dto: CreateRecurringSessionsDto,
  ): Promise<WorkoutSession[]> {
    const dates = generateRecurringCalendarDates(dto.dateFrom, dto.dateTo, dto.daysOfWeek);
    if (dates.length === 0) {
      return [];
    }

    const candidateSlots = dates.map((dateItem) =>
      buildUtcSessionTimes(dateItem, dto.startTime, dto.endTime, dto.timezoneOffset),
    );

    const validSlots = await this.filterNonConflictingSlots(trainerId, candidateSlots);
    if (validSlots.length === 0) {
      return [];
    }

    return this.prisma.$transaction(
      async (tx) => {
        const sessionsData = validSlots.map((slot) => ({
          trainerId,
          locationId: dto.locationId,
          type: 'INDIVIDUAL' as const,
          startTime: slot.startTime,
          endTime: slot.endTime,
          price: dto.price ?? 0,
          status: 'UPCOMING' as const,
          workoutTypes: dto.workoutTypes || [],
          subscriptionId: dto.subscriptionId,
        }));

        const createdSessions = await tx.workoutSession.createManyAndReturn({
          data: sessionsData,
          select: { id: true },
        });

        const participantsData = createdSessions.map((session) => ({
          sessionId: session.id,
          clientId: dto.clientId,
        }));

        await tx.sessionParticipant.createMany({
          data: participantsData,
        });

        if (dto.subscriptionId) {
          await this.subscriptionsService.recalculateSubscriptionUsage(
            trainerId,
            dto.subscriptionId,
            tx,
          );
        }

        const sessionIds = createdSessions.map((s) => s.id);
        return tx.workoutSession.findMany({
          where: { id: { in: sessionIds } },
          include: {
            location: true,
            participants: { include: { client: true } },
          },
          orderBy: { startTime: 'asc' },
        });
      },
      { maxWait: 10000, timeout: 30000 },
    );
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

  private async filterNonConflictingSlots(
    trainerId: number,
    candidateSlots: { startTime: Date; endTime: Date }[],
  ): Promise<{ startTime: Date; endTime: Date }[]> {
    if (candidateSlots.length === 0) {
      return [];
    }

    const rangeStart = new Date(Math.min(...candidateSlots.map((s) => s.startTime.getTime())));
    const rangeEnd = new Date(Math.max(...candidateSlots.map((s) => s.endTime.getTime())));

    const existingSessions = await this.prisma.workoutSession.findMany({
      where: {
        trainerId,
        startTime: { lt: rangeEnd },
        endTime: { gt: rangeStart },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    const validSlots: { startTime: Date; endTime: Date }[] = [];
    for (const slot of candidateSlots) {
      const hasDbConflict = existingSessions.some(
        (existing) => existing.startTime < slot.endTime && existing.endTime > slot.startTime,
      );
      const hasBatchConflict = validSlots.some(
        (prev) => prev.startTime < slot.endTime && prev.endTime > slot.startTime,
      );

      if (hasDbConflict || hasBatchConflict) {
        continue;
      }

      validSlots.push(slot);
    }

    return validSlots;
  }
}
