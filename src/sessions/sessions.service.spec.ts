/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../modules/telegram/telegram.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

describe('SessionsService', () => {
  let service: SessionsService;
  let prisma: any;
  let subscriptionsService: any;
  let telegramService: any;

  const mockTrainerId = 1;
  const mockSessionId = 100;
  const mockSubscriptionId = 5;

  const mockSessionWithoutSub = {
    id: mockSessionId,
    trainerId: mockTrainerId,
    locationId: 1,
    subscriptionId: null,
    status: 'UPCOMING',
    price: 300,
    startTime: new Date('2026-10-01T10:00:00Z'),
    endTime: new Date('2026-10-01T11:00:00Z'),
    participants: [],
  };

  const mockSessionWithSub = {
    ...mockSessionWithoutSub,
    subscriptionId: mockSubscriptionId,
  };

  beforeEach(async () => {
    prisma = {
      workoutSession: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: any) => any) => callback(prisma)),
    };

    telegramService = {
      sendMessage: jest.fn(),
    };

    subscriptionsService = {
      recalculateSubscriptionUsage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TelegramService, useValue: telegramService },
        { provide: SubscriptionsService, useValue: subscriptionsService },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('remove', () => {
    it('should delete a standalone session directly without subscription recalculation', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue(mockSessionWithoutSub);
      prisma.workoutSession.delete.mockResolvedValue(mockSessionWithoutSub);

      const result = await service.remove(mockTrainerId, mockSessionId);

      expect(result).toEqual(mockSessionWithoutSub);
      expect(prisma.workoutSession.delete).toHaveBeenCalledWith({ where: { id: mockSessionId } });
      expect(subscriptionsService.recalculateSubscriptionUsage).not.toHaveBeenCalled();
    });

    it('should delete session and recalculate subscription inside transaction if subscriptionId is present', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue(mockSessionWithSub);
      prisma.workoutSession.delete.mockResolvedValue(mockSessionWithSub);
      subscriptionsService.recalculateSubscriptionUsage.mockResolvedValue({
        id: mockSubscriptionId,
        usedSessions: 4,
      });

      const result = await service.remove(mockTrainerId, mockSessionId);

      expect(result).toEqual(mockSessionWithSub);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.workoutSession.delete).toHaveBeenCalledWith({ where: { id: mockSessionId } });
      expect(subscriptionsService.recalculateSubscriptionUsage).toHaveBeenCalledWith(
        mockTrainerId,
        mockSubscriptionId,
        prisma,
      );
    });

    it('should throw NotFoundException if session does not belong to trainer', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue({
        ...mockSessionWithoutSub,
        trainerId: 999,
      });

      await expect(service.remove(mockTrainerId, mockSessionId)).rejects.toThrow(NotFoundException);
    });
  });
});
