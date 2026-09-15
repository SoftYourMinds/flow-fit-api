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
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workoutSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
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
});
