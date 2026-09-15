import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';

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
import {
  generateRecurringCalendarDates,
  buildUtcSessionTimes,
} from '../shared/utils/date-time.util';

@Injectable()
export class SubscriptionsService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reconcileAllSubscriptions();
  }

  // ─── Public Methods ─────────────────────────────────────────────

  async create(trainerId: number, dto: CreateSubscriptionDto): Promise<ClientSubscription> {
    const clientId = Number(dto.clientId);
    await this.validateClientOwnership(trainerId, clientId);
    this.validateSubscriptionFields(dto);

    const startDate = dto.startDate ? new Date(dto.startDate) : undefined;
    const endDate = dto.endDate ? new Date(dto.endDate) : undefined;
    await this.validateNoOverlappingActiveSubscription(
      trainerId,
      clientId,
      dto.type || SubscriptionType.SESSIONS_BASED,
      startDate,
      endDate,
    );

    return this.prisma.clientSubscription.create({
      data: {
        trainerId,
        clientId,
        type: dto.type || SubscriptionType.SESSIONS_BASED,
        totalSessions: dto.totalSessions,
        startDate,
        endDate,
        price: dto.price ?? 0,
        isPaid: dto.isPaid ?? false,
      },
      include: { client: true },
    });
  }

  async findAll(trainerId: number, query: SubscriptionQueryDto): Promise<ClientSubscription[]> {
    const where: Prisma.ClientSubscriptionWhereInput = { trainerId };

    if (query.clientId) {
      where.clientId = Number(query.clientId);
    }
    if (query.status && Object.values(SubscriptionStatus).includes(query.status)) {
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
    const current = await this.findOne(trainerId, id);

    const data: Prisma.ClientSubscriptionUpdateInput = {};

    if (dto.totalSessions !== undefined) data.totalSessions = dto.totalSessions;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.isPaid !== undefined) data.isPaid = dto.isPaid;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.status !== undefined) data.status = dto.status;

    const willBeActive =
      dto.status === SubscriptionStatus.ACTIVE ||
      (!dto.status && current.status === SubscriptionStatus.ACTIVE);
    if (willBeActive) {
      const targetType = dto.type || current.type;
      const targetStartDate = dto.startDate
        ? new Date(dto.startDate)
        : (current.startDate ?? undefined);
      const targetEndDate = dto.endDate ? new Date(dto.endDate) : (current.endDate ?? undefined);
      await this.validateNoOverlappingActiveSubscription(
        trainerId,
        current.clientId,
        targetType,
        targetStartDate,
        targetEndDate,
        id,
      );
    }

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

  async unlinkSession(
    trainerId: number,
    subscriptionId: number,
    sessionId: number,
  ): Promise<ClientSubscription> {
    await this.findOne(trainerId, subscriptionId);

    const session = await this.prisma.workoutSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.trainerId !== trainerId) {
      throw new NotFoundException('Тренування не знайдено');
    }

    if (session.subscriptionId !== subscriptionId) {
      throw new BadRequestException('Це тренування не прив’язане до цього абонементу');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.workoutSession.update({
        where: { id: sessionId },
        data: {
          subscriptionId: null,
          isPaid: false,
        },
      });

      return this.recalculateSubscriptionUsage(trainerId, subscriptionId, tx);
    });
  }

  async recalculateSubscriptionUsage(
    trainerId: number,
    subscriptionId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<ClientSubscription> {
    const prismaClient = tx ?? this.prisma;

    const subscription = await prismaClient.clientSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || subscription.trainerId !== trainerId) {
      throw new NotFoundException('Абонемент не знайдено');
    }

    const actualSessionsCount = await prismaClient.workoutSession.count({
      where: {
        trainerId,
        subscriptionId,
      },
    });

    const nextStatus = this.determineNextSubscriptionStatus(subscription, actualSessionsCount);

    return prismaClient.clientSubscription.update({
      where: { id: subscriptionId },
      data: {
        usedSessions: actualSessionsCount,
        status: nextStatus,
      },
      include: { client: true },
    });
  }

  async reconcileAllSubscriptions(trainerId?: number): Promise<{ reconciledCount: number }> {
    const where: Prisma.ClientSubscriptionWhereInput = trainerId ? { trainerId } : {};
    const subscriptions = await this.prisma.clientSubscription.findMany({ where });

    let reconciledCount = 0;

    for (const sub of subscriptions) {
      const actualCount = await this.prisma.workoutSession.count({
        where: {
          trainerId: sub.trainerId,
          subscriptionId: sub.id,
        },
      });

      const nextStatus = this.determineNextSubscriptionStatus(sub, actualCount);
      const needsUpdate = sub.usedSessions !== actualCount || sub.status !== nextStatus;

      if (!needsUpdate) {
        continue;
      }

      await this.prisma.clientSubscription.update({
        where: { id: sub.id },
        data: {
          usedSessions: actualCount,
          status: nextStatus,
        },
      });
      reconciledCount++;
    }

    return { reconciledCount };
  }

  async getActiveForClient(trainerId: number, clientId: number): Promise<ClientSubscription[]> {
    return this.prisma.clientSubscription.findMany({
      where: {
        trainerId,
        clientId: Number(clientId),
        status: SubscriptionStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWithRecurring(
    trainerId: number,
    dto: CreateSubscriptionWithRecurringDto,
  ): Promise<{ subscription: ClientSubscription; sessionsCount: number }> {
    const clientId = Number(dto.clientId);
    await this.validateClientOwnership(trainerId, clientId);

    const dates = generateRecurringCalendarDates(dto.dateFrom, dto.dateTo, dto.daysOfWeek);
    if (dates.length === 0) {
      throw new BadRequestException('У вибраному діапазоні дат не знайдено відповідних днів тижня');
    }

    const { startTime: startDate } = buildUtcSessionTimes(
      dates[0],
      dto.startTime,
      dto.endTime,
      dto.timezoneOffset,
    );
    const { endTime: endDate } = buildUtcSessionTimes(
      dates[dates.length - 1],
      dto.startTime,
      dto.endTime,
      dto.timezoneOffset,
    );

    await this.validateNoOverlappingActiveSubscription(
      trainerId,
      clientId,
      SubscriptionType.DATE_RANGE,
      startDate,
      endDate,
    );

    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.clientSubscription.create({
        data: {
          trainerId,
          clientId,
          type: SubscriptionType.DATE_RANGE,
          startDate,
          endDate,
          totalSessions: dates.length,
          usedSessions: 0,
          price: dto.price ?? 0,
          isPaid: dto.isPaid ?? false,
          status: SubscriptionStatus.ACTIVE,
        },
        include: { client: true },
      });

      let sessionsCreated = 0;
      for (const dateItem of dates) {
        const { startTime, endTime } = buildUtcSessionTimes(
          dateItem,
          dto.startTime,
          dto.endTime,
          dto.timezoneOffset,
        );

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
              create: { clientId },
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

  private async validateNoOverlappingActiveSubscription(
    trainerId: number,
    clientId: number,
    type: SubscriptionType,
    startDate?: Date,
    endDate?: Date,
    excludeSubscriptionId?: number,
  ): Promise<void> {
    const activeSubs =
      (await this.prisma.clientSubscription.findMany({
        where: {
          trainerId,
          clientId,
          status: SubscriptionStatus.ACTIVE,
          ...(excludeSubscriptionId ? { id: { not: excludeSubscriptionId } } : {}),
        },
      })) || [];

    if (activeSubs.length === 0) {
      return;
    }

    if (type === SubscriptionType.DATE_RANGE && startDate && endDate) {
      for (const sub of activeSubs) {
        if (sub.type === SubscriptionType.DATE_RANGE && sub.startDate && sub.endDate) {
          const hasOverlap = startDate <= sub.endDate && endDate >= sub.startDate;
          if (hasOverlap) {
            throw new BadRequestException('У клієнта вже є активний абонемент на цей термін');
          }
        }
      }
    } else if (type === SubscriptionType.SESSIONS_BASED) {
      const hasActiveSessionsSub = activeSubs.some(
        (sub) =>
          sub.type === SubscriptionType.SESSIONS_BASED &&
          sub.totalSessions !== null &&
          sub.usedSessions < sub.totalSessions,
      );
      if (hasActiveSessionsSub) {
        throw new BadRequestException('У клієнта вже є активний абонемент по кількості занять');
      }
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

  private determineNextSubscriptionStatus(
    subscription: ClientSubscription,
    actualSessionsCount: number,
  ): SubscriptionStatus {
    const isSessionsBased =
      subscription.type === SubscriptionType.SESSIONS_BASED && subscription.totalSessions !== null;

    if (!isSessionsBased) {
      return subscription.status;
    }

    const isExhausted = actualSessionsCount >= (subscription.totalSessions ?? 0);
    if (isExhausted) {
      return SubscriptionStatus.EXHAUSTED;
    }

    const wasExhausted = subscription.status === SubscriptionStatus.EXHAUSTED;
    if (wasExhausted) {
      return SubscriptionStatus.ACTIVE;
    }

    return subscription.status;
  }
}
