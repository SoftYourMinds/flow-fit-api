/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionStatus, SubscriptionType } from '@prisma/client';

import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: any;

  const mockTrainerId = 1;
  const mockClientId = 10;
  const mockSessionId = 100;

  const mockSubscription = {
    id: 5,
    trainerId: mockTrainerId,
    clientId: mockClientId,
    type: SubscriptionType.SESSIONS_BASED,
    status: SubscriptionStatus.ACTIVE,
    totalSessions: 10,
    usedSessions: 0,
    startDate: null,
    endDate: null,
    price: 3000,
    isPaid: true,
    reminderSent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSession = {
    id: mockSessionId,
    trainerId: mockTrainerId,
    subscriptionId: null,
    isPaid: false,
  };

  beforeEach(async () => {
    prisma = {
      client: {
        findUnique: jest.fn(),
      },
      clientSubscription: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workoutSession: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: any) => any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SubscriptionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a subscription when client belongs to trainer', async () => {
      prisma.client.findUnique.mockResolvedValue({ id: mockClientId, trainerId: mockTrainerId });
      prisma.clientSubscription.create.mockResolvedValue(mockSubscription);

      const result = await service.create(mockTrainerId, {
        clientId: mockClientId,
        type: SubscriptionType.SESSIONS_BASED,
        totalSessions: 10,
        price: 3000,
      });

      expect(result).toEqual(mockSubscription);
      expect(prisma.clientSubscription.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when client belongs to another trainer', async () => {
      prisma.client.findUnique.mockResolvedValue({ id: mockClientId, trainerId: 999 });

      await expect(
        service.create(mockTrainerId, {
          clientId: mockClientId,
          type: SubscriptionType.SESSIONS_BASED,
          totalSessions: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when client already has active sessions subscription', async () => {
      prisma.client.findUnique.mockResolvedValue({ id: mockClientId, trainerId: mockTrainerId });
      prisma.clientSubscription.findMany.mockResolvedValue([mockSubscription]);

      await expect(
        service.create(mockTrainerId, {
          clientId: mockClientId,
          type: SubscriptionType.SESSIONS_BASED,
          totalSessions: 8,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when date range overlaps existing active subscription', async () => {
      prisma.client.findUnique.mockResolvedValue({ id: mockClientId, trainerId: mockTrainerId });
      prisma.clientSubscription.findMany.mockResolvedValue([
        {
          ...mockSubscription,
          type: SubscriptionType.DATE_RANGE,
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-09-30'),
        },
      ]);

      await expect(
        service.create(mockTrainerId, {
          clientId: mockClientId,
          type: SubscriptionType.DATE_RANGE,
          startDate: '2026-09-15',
          endDate: '2026-10-15',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deductSession', () => {
    it('should deduct a session and mark session as paid with transaction', async () => {
      prisma.clientSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.workoutSession.findUnique.mockResolvedValue(mockSession);
      prisma.clientSubscription.update.mockResolvedValue({
        ...mockSubscription,
        usedSessions: 1,
      });

      const result = await service.deductSession(mockTrainerId, mockSubscription.id, mockSessionId);

      expect(prisma.workoutSession.update).toHaveBeenCalledWith({
        where: { id: mockSessionId },
        data: { subscriptionId: mockSubscription.id, isPaid: true },
      });
      expect(prisma.clientSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSubscription.id },
          data: expect.objectContaining({ usedSessions: 1 }),
        }),
      );
      expect(result.usedSessions).toBe(1);
    });

    it('should mark subscription EXHAUSTED when usedSessions reaches totalSessions', async () => {
      const nearlyExhausted = {
        ...mockSubscription,
        totalSessions: 5,
        usedSessions: 4,
      };
      prisma.clientSubscription.findUnique.mockResolvedValue(nearlyExhausted);
      prisma.workoutSession.findUnique.mockResolvedValue(mockSession);
      prisma.clientSubscription.update.mockResolvedValue({
        ...nearlyExhausted,
        usedSessions: 5,
        status: SubscriptionStatus.EXHAUSTED,
      });

      await service.deductSession(mockTrainerId, mockSubscription.id, mockSessionId);

      expect(prisma.clientSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            usedSessions: 5,
            status: SubscriptionStatus.EXHAUSTED,
          }),
        }),
      );
    });

    it('should throw BadRequestException if subscription is already EXHAUSTED', async () => {
      prisma.clientSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.EXHAUSTED,
      });

      await expect(
        service.deductSession(mockTrainerId, mockSubscription.id, mockSessionId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if session is already deducted', async () => {
      prisma.clientSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.workoutSession.findUnique.mockResolvedValue({
        ...mockSession,
        subscriptionId: 99,
      });

      await expect(
        service.deductSession(mockTrainerId, mockSubscription.id, mockSessionId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createWithRecurring', () => {
    it('should create subscription and recurring sessions in transaction', async () => {
      prisma.client.findUnique.mockResolvedValue({ id: mockClientId, trainerId: mockTrainerId });
      prisma.clientSubscription.create.mockResolvedValue(mockSubscription);
      prisma.workoutSession.findFirst.mockResolvedValue(null);
      prisma.workoutSession.create.mockResolvedValue(mockSession);

      const result = await service.createWithRecurring(mockTrainerId, {
        clientId: mockClientId,
        locationId: 1,
        daysOfWeek: [1, 3, 5],
        startTime: '10:00',
        endTime: '11:00',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-14',
        price: 3000,
        isPaid: true,
      });

      expect(result.subscription).toEqual(mockSubscription);
      expect(result.sessionsCount).toBeGreaterThan(0);
      expect(prisma.clientSubscription.create).toHaveBeenCalled();
      expect(prisma.workoutSession.create).toHaveBeenCalled();
    });
  });

  describe('getSubscriptionSessions', () => {
    it('should return sessions linked to subscription', async () => {
      prisma.clientSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.workoutSession.findMany.mockResolvedValue([mockSession]);

      const result = await service.getSubscriptionSessions(mockTrainerId, mockSubscription.id);

      expect(result).toEqual([mockSession]);
      expect(prisma.workoutSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { trainerId: mockTrainerId, subscriptionId: mockSubscription.id },
        }),
      );
    });
  });

  describe('recalculateSubscriptionUsage', () => {
    it('should recalculate usedSessions based on workoutSession.count', async () => {
      prisma.clientSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.workoutSession.count.mockResolvedValue(4);
      prisma.clientSubscription.update.mockResolvedValue({
        ...mockSubscription,
        usedSessions: 4,
      });

      const result = await service.recalculateSubscriptionUsage(mockTrainerId, mockSubscription.id);

      expect(prisma.workoutSession.count).toHaveBeenCalledWith({
        where: { trainerId: mockTrainerId, subscriptionId: mockSubscription.id },
      });
      expect(prisma.clientSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSubscription.id },
          data: expect.objectContaining({ usedSessions: 4, status: SubscriptionStatus.ACTIVE }),
        }),
      );
      expect(result.usedSessions).toBe(4);
    });

    it('should mark subscription EXHAUSTED if actual count reaches totalSessions', async () => {
      prisma.clientSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        totalSessions: 10,
        status: SubscriptionStatus.ACTIVE,
      });
      prisma.workoutSession.count.mockResolvedValue(10);
      prisma.clientSubscription.update.mockResolvedValue({
        ...mockSubscription,
        usedSessions: 10,
        status: SubscriptionStatus.EXHAUSTED,
      });

      await service.recalculateSubscriptionUsage(mockTrainerId, mockSubscription.id);

      expect(prisma.clientSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            usedSessions: 10,
            status: SubscriptionStatus.EXHAUSTED,
          }),
        }),
      );
    });

    it('should restore status to ACTIVE if previously EXHAUSTED and count is now less than total', async () => {
      prisma.clientSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        totalSessions: 10,
        status: SubscriptionStatus.EXHAUSTED,
      });
      prisma.workoutSession.count.mockResolvedValue(9);
      prisma.clientSubscription.update.mockResolvedValue({
        ...mockSubscription,
        usedSessions: 9,
        status: SubscriptionStatus.ACTIVE,
      });

      await service.recalculateSubscriptionUsage(mockTrainerId, mockSubscription.id);

      expect(prisma.clientSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            usedSessions: 9,
            status: SubscriptionStatus.ACTIVE,
          }),
        }),
      );
    });

    it('should throw NotFoundException if subscription not found or belongs to another trainer', async () => {
      prisma.clientSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        trainerId: 999,
      });

      await expect(
        service.recalculateSubscriptionUsage(mockTrainerId, mockSubscription.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unlinkSession', () => {
    it('should unlink session and recalculate subscription usage', async () => {
      prisma.clientSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.workoutSession.findUnique.mockResolvedValue({
        ...mockSession,
        subscriptionId: mockSubscription.id,
      });
      prisma.workoutSession.update.mockResolvedValue({
        ...mockSession,
        subscriptionId: null,
        isPaid: false,
      });
      prisma.workoutSession.count.mockResolvedValue(3);
      prisma.clientSubscription.update.mockResolvedValue({
        ...mockSubscription,
        usedSessions: 3,
      });

      const result = await service.unlinkSession(mockTrainerId, mockSubscription.id, mockSessionId);

      expect(prisma.workoutSession.update).toHaveBeenCalledWith({
        where: { id: mockSessionId },
        data: { subscriptionId: null, isPaid: false },
      });
      expect(result.usedSessions).toBe(3);
    });

    it('should throw BadRequestException if session is not linked to this subscription', async () => {
      prisma.clientSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.workoutSession.findUnique.mockResolvedValue({
        ...mockSession,
        subscriptionId: 999,
      });

      await expect(
        service.unlinkSession(mockTrainerId, mockSubscription.id, mockSessionId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reconcileAllSubscriptions', () => {
    it('should update subscriptions whose counts or statuses are out of sync', async () => {
      const outOfSyncSub = {
        ...mockSubscription,
        id: 1,
        usedSessions: 7, // Says 7 in DB, but actually 4
        totalSessions: 12,
        status: SubscriptionStatus.ACTIVE,
      };
      prisma.clientSubscription.findMany.mockResolvedValue([outOfSyncSub]);
      prisma.workoutSession.count.mockResolvedValue(4);
      prisma.clientSubscription.update.mockResolvedValue({
        ...outOfSyncSub,
        usedSessions: 4,
      });

      const res = await service.reconcileAllSubscriptions(mockTrainerId);

      expect(res.reconciledCount).toBe(1);
      expect(prisma.clientSubscription.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { usedSessions: 4, status: SubscriptionStatus.ACTIVE },
      });
    });

    it('should do nothing if subscriptions are already in sync', async () => {
      const inSyncSub = {
        ...mockSubscription,
        id: 2,
        usedSessions: 4,
        totalSessions: 12,
        status: SubscriptionStatus.ACTIVE,
      };
      prisma.clientSubscription.findMany.mockResolvedValue([inSyncSub]);
      prisma.workoutSession.count.mockResolvedValue(4);

      const res = await service.reconcileAllSubscriptions(mockTrainerId);

      expect(res.reconciledCount).toBe(0);
      expect(prisma.clientSubscription.update).not.toHaveBeenCalled();
    });
  });

  describe('onApplicationBootstrap', () => {
    it('should trigger reconcileAllSubscriptions on boot', async () => {
      const spy = jest
        .spyOn(service, 'reconcileAllSubscriptions')
        .mockResolvedValue({ reconciledCount: 0 });

      await service.onApplicationBootstrap();

      expect(spy).toHaveBeenCalled();
    });
  });
});
