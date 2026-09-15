import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CreateSubscriptionWithRecurringDto } from './dto/create-subscription-with-recurring.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionQueryDto } from './dto/subscription-query.dto';
import {
  ClientSubscription,
  Prisma,
  SubscriptionStatus,
  SubscriptionType,
  WorkoutSession,
} from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Public Methods ─────────────────────────────────────────────

  async create(trainerId: number, dto: CreateSubscriptionDto): Promise<ClientSubscription> {
    await this.validateClientOwnership(trainerId, dto.clientId);
    this.validateSubscriptionFields(dto);

    return this.prisma.clientSubscription.create({
      data: {
        trainerId,
        clientId: dto.clientId,
        type: dto.type || SubscriptionType.SESSIONS_BASED,
        totalSessions: dto.totalSessions,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        price: dto.price ?? 0,
        isPaid: dto.isPaid ?? false,
      },
      include: { client: true },
    });
  }

  async findAll(trainerId: number, query: SubscriptionQueryDto): Promise<ClientSubscription[]> {
    const where: Prisma.ClientSubscriptionWhereInput = { trainerId };

    if (query.clientId) {
      where.clientId = query.clientId;
    }
    if (query.status) {
      where.status = query.status;
    }

    return this.prisma.clientSubscription.findMany({
      where,
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(trainerId: number, id: number): Promise<ClientSubscription> {
    const subscription = await this.prisma.clientSubscription.findUnique({
      where: { id },
      include: { client: true, sessions: true },
    });

    if (!subscription || subscription.trainerId !== trainerId) {
      throw new NotFoundException('Абонемент не знайдено');
    }

    return subscription;
  }

  async update(
    trainerId: number,
    id: number,
    dto: UpdateSubscriptionDto,
  ): Promise<ClientSubscription> {
    await this.findOne(trainerId, id);

    const data: Prisma.ClientSubscriptionUpdateInput = {};

    if (dto.totalSessions !== undefined) data.totalSessions = dto.totalSessions;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.isPaid !== undefined) data.isPaid = dto.isPaid;
    if (dto.type !== undefined) data.type = dto.type;

    return this.prisma.clientSubscription.update({
      where: { id },
      data,
      include: { client: true },
    });
  }

  async remove(trainerId: number, id: number): Promise<ClientSubscription> {
    await this.findOne(trainerId, id);

    return this.prisma.clientSubscription.delete({
      where: { id },
    });
  }

  async deductSession(
    trainerId: number,
    subscriptionId: number,
    sessionId: number,
  ): Promise<ClientSubscription> {
    const subscription = await this.findOne(trainerId, subscriptionId);

    this.validateDeduction(subscription);

    const session = await this.prisma.workoutSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.trainerId !== trainerId) {
      throw new NotFoundException('Тренування не знайдено');
    }

    const alreadyDeducted = session.subscriptionId !== null;
    if (alreadyDeducted) {
      throw new BadRequestException('Це тренування вже списане з абонементу');
    }

    const newUsedSessions = subscription.usedSessions + 1;
    const isExhausted =
      subscription.type === SubscriptionType.SESSIONS_BASED &&
      subscription.totalSessions !== null &&
      newUsedSessions >= subscription.totalSessions;

    return this.prisma.$transaction(async (tx) => {
      await tx.workoutSession.update({
        where: { id: sessionId },
        data: {
          subscriptionId,
          isPaid: true,
        },
      });

      return tx.clientSubscription.update({
        where: { id: subscriptionId },
        data: {
          usedSessions: newUsedSessions,
          status: isExhausted ? SubscriptionStatus.EXHAUSTED : undefined,
        },
        include: { client: true },
      });
    });
  }

  async getActiveForClient(trainerId: number, clientId: number): Promise<ClientSubscription[]> {
    return this.prisma.clientSubscription.findMany({
      where: {
        trainerId,
        clientId,
        status: SubscriptionStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWithRecurring(
    trainerId: number,
    dto: CreateSubscriptionWithRecurringDto,
  ): Promise<{ subscription: ClientSubscription; sessionsCount: number }> {
    await this.validateClientOwnership(trainerId, dto.clientId);

    const dates = this.generateRecurringDates(dto.dateFrom, dto.dateTo, dto.daysOfWeek);
    if (dates.length === 0) {
      throw new BadRequestException('У вибраному діапазоні дат не знайдено відповідних днів тижня');
    }

    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.clientSubscription.create({
        data: {
          trainerId,
          clientId: dto.clientId,
          type: SubscriptionType.DATE_RANGE,
          startDate: new Date(dto.dateFrom),
          endDate: new Date(dto.dateTo),
          totalSessions: dates.length,
          usedSessions: 0,
          price: dto.price ?? 0,
          isPaid: dto.isPaid ?? false,
          status: SubscriptionStatus.ACTIVE,
        },
        include: { client: true },
      });

      let sessionsCreated = 0;
      for (const date of dates) {
        const { startTime, endTime } = this.buildSessionTimes(date, dto.startTime, dto.endTime);

        const hasConflict = await tx.workoutSession.findFirst({
          where: {
            trainerId,
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        });

        if (hasConflict) {
          continue;
        }

        await tx.workoutSession.create({
          data: {
            trainerId,
            locationId: dto.locationId,
            type: 'INDIVIDUAL',
            startTime,
            endTime,
            price: 0,
            status: 'UPCOMING',
            isPaid: true,
            subscriptionId: subscription.id,
            workoutTypes: dto.workoutTypes || [],
            participants: {
              create: { clientId: dto.clientId },
            },
          },
        });
        sessionsCreated++;
      }

      return { subscription, sessionsCount: sessionsCreated };
    });
  }

  async getSubscriptionSessions(
    trainerId: number,
    subscriptionId: number,
  ): Promise<WorkoutSession[]> {
    await this.findOne(trainerId, subscriptionId);

    return this.prisma.workoutSession.findMany({
      where: {
        trainerId,
        subscriptionId,
      },
      include: {
        location: true,
        participants: { include: { client: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private async validateClientOwnership(trainerId: number, clientId: number): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client || client.trainerId !== trainerId) {
      throw new NotFoundException('Клієнта не знайдено');
    }
  }

  private validateSubscriptionFields(dto: CreateSubscriptionDto): void {
    const type = dto.type || SubscriptionType.SESSIONS_BASED;

    if (type === SubscriptionType.SESSIONS_BASED && !dto.totalSessions) {
      throw new BadRequestException('Для абонементу по кількості потрібно вказати totalSessions');
    }

    if (type === SubscriptionType.DATE_RANGE && (!dto.startDate || !dto.endDate)) {
      throw new BadRequestException(
        'Для абонементу по датах потрібно вказати startDate та endDate',
      );
    }

    if (dto.startDate && dto.endDate && new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException('Дата початку має бути раніше дати закінчення');
    }
  }

  private validateDeduction(subscription: ClientSubscription): void {
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Абонемент не активний');
    }

    if (subscription.type === SubscriptionType.DATE_RANGE && subscription.endDate) {
      const isExpired = new Date() > subscription.endDate;
      if (isExpired) {
        throw new BadRequestException('Абонемент прострочений');
      }
    }

    if (subscription.type === SubscriptionType.SESSIONS_BASED && subscription.totalSessions) {
      const isExhausted = subscription.usedSessions >= subscription.totalSessions;
      if (isExhausted) {
        throw new BadRequestException('Всі тренування по абонементу використані');
      }
    }
  }

  private generateRecurringDates(dateFrom: string, dateTo: string, daysOfWeek: number[]): Date[] {
    const dates: Date[] = [];
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const current = new Date(from);

    while (current <= to) {
      if (daysOfWeek.includes(current.getDay())) {
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
