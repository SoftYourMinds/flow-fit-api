/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
    type: 'INDIVIDUAL',
    status: 'UPCOMING',
    price: 300,
    anonymousParticipantsCount: 0,
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
        createManyAndReturn: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      sessionParticipant: {
        create: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
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

  describe('create', () => {
    it('should coerce numeric reminderMode to string before saving to Prisma', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);
      prisma.workoutSession.create.mockResolvedValue(mockSessionWithoutSub);

      await service.create(mockTrainerId, {
        locationId: 2,
        type: 'INDIVIDUAL',
        startTime: '2026-11-13T12:00:00.000Z',
        endTime: '2026-11-13T12:50:00.000Z',
        price: 350,
        enableNotification: true,
        reminderMode: 120 as unknown as string,
        isCritical: true,
      });

      expect(prisma.workoutSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            enableNotification: true,
            reminderMode: '120',
            isCritical: true,
          }),
        }),
      );
    });

    it('should default reminderMode to "auto" when omitted', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);
      prisma.workoutSession.create.mockResolvedValue(mockSessionWithoutSub);

      await service.create(mockTrainerId, {
        locationId: 2,
        startTime: '2026-11-13T12:00:00.000Z',
        endTime: '2026-11-13T12:50:00.000Z',
      });

      expect(prisma.workoutSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reminderMode: 'auto',
          }),
        }),
      );
    });

    it('should convert Prisma serialization conflict (P2034) into ConflictException to prevent duplicate concurrent sessions', async () => {
      prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });

      await expect(
        service.create(mockTrainerId, {
          locationId: 2,
          startTime: '2026-11-13T12:00:00.000Z',
          endTime: '2026-11-13T12:50:00.000Z',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create GROUP session with combined anonymous count, clients, and custom names', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);
      prisma.workoutSession.create.mockResolvedValue({
        ...mockSessionWithoutSub,
        type: 'GROUP',
        anonymousParticipantsCount: 3,
      });

      await service.create(mockTrainerId, {
        locationId: 2,
        type: 'GROUP',
        startTime: '2026-11-13T12:00:00.000Z',
        endTime: '2026-11-13T12:50:00.000Z',
        anonymousParticipantsCount: 3,
        participants: [{ clientId: 2 }, { customName: ' Аня ' }, { customName: 'Лера' }],
      });

      expect(prisma.workoutSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'GROUP',
            anonymousParticipantsCount: 3,
            participants: {
              create: [{ clientId: 2 }, { customName: 'Аня' }, { customName: 'Лера' }],
            },
          }),
        }),
      );
    });

    it('should throw BadRequestException when INDIVIDUAL session exceeds 1 total participant', async () => {
      await expect(
        service.create(mockTrainerId, {
          locationId: 2,
          type: 'INDIVIDUAL',
          startTime: '2026-11-13T12:00:00.000Z',
          endTime: '2026-11-13T12:50:00.000Z',
          anonymousParticipantsCount: 1,
          participants: [{ clientId: 2 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should coerce numeric reminderMode to string and reset reminderSentAt on update', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue(mockSessionWithoutSub);
      prisma.workoutSession.update.mockResolvedValue(mockSessionWithoutSub);

      await service.update(mockTrainerId, mockSessionId, {
        enableNotification: true,
        reminderMode: 60 as unknown as string,
        isCritical: true,
      });

      expect(prisma.workoutSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSessionId },
          data: expect.objectContaining({
            enableNotification: true,
            reminderMode: '60',
            isCritical: true,
            reminderSentAt: null,
          }),
        }),
      );
    });

    it('should replace participants in transaction when participants array is provided', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue({
        ...mockSessionWithoutSub,
        type: 'GROUP',
      });
      prisma.workoutSession.update.mockResolvedValue({
        ...mockSessionWithoutSub,
        type: 'GROUP',
        anonymousParticipantsCount: 2,
      });

      await service.update(mockTrainerId, mockSessionId, {
        anonymousParticipantsCount: 2,
        participants: [{ clientId: 7 }, { customName: 'Аня' }],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.sessionParticipant.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: mockSessionId },
      });
      expect(prisma.sessionParticipant.createMany).toHaveBeenCalledWith({
        data: [
          { sessionId: mockSessionId, clientId: 7, customName: undefined },
          { sessionId: mockSessionId, clientId: undefined, customName: 'Аня' },
        ],
      });
    });

    it('should throw BadRequestException when updating to INDIVIDUAL with more than 1 participant', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue({
        ...mockSessionWithoutSub,
        type: 'GROUP',
        anonymousParticipantsCount: 2,
        participants: [{ id: 1, clientId: 2, customName: null }],
      });

      await expect(
        service.update(mockTrainerId, mockSessionId, {
          type: 'INDIVIDUAL',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addParticipant', () => {
    it('should throw BadRequestException when adding a participant to an INDIVIDUAL session that already has 1 participant', async () => {
      prisma.workoutSession.findUnique.mockResolvedValue({
        ...mockSessionWithoutSub,
        type: 'INDIVIDUAL',
        anonymousParticipantsCount: 1,
        participants: [],
      });

      await expect(
        service.addParticipant(mockTrainerId, mockSessionId, { clientId: 3 }),
      ).rejects.toThrow(BadRequestException);
    });
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

  describe('previewRecurringSessions', () => {
    it('should preview recurring dates and identify conflicts', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([
        {
          startTime: new Date('2026-10-02T07:00:00.000Z'),
          endTime: new Date('2026-10-02T08:00:00.000Z'),
        },
      ]);

      const result = await service.previewRecurringSessions(mockTrainerId, {
        clientId: 1,
        locationId: 1,
        daysOfWeek: [1, 5],
        startTime: '10:00',
        endTime: '11:00',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-07',
        timezoneOffset: -180,
      });

      expect(prisma.workoutSession.findMany).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.hasConflict)).toBe(true);
    });
  });

  describe('createRecurringSessions', () => {
    it('should batch create sessions and participants in transaction', async () => {
      prisma.workoutSession.findMany
        .mockResolvedValueOnce([]) // for conflict checking
        .mockResolvedValueOnce([mockSessionWithoutSub]); // for return query

      prisma.workoutSession.createManyAndReturn.mockResolvedValue([{ id: 101 }]);
      prisma.sessionParticipant.createMany.mockResolvedValue({ count: 1 });

      const result = await service.createRecurringSessions(mockTrainerId, {
        clientId: 1,
        locationId: 1,
        daysOfWeek: [1, 5],
        startTime: '10:00',
        endTime: '11:00',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-07',
        timezoneOffset: -180,
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.workoutSession.createManyAndReturn).toHaveBeenCalled();
      expect(prisma.sessionParticipant.createMany).toHaveBeenCalled();
      expect(result).toEqual([mockSessionWithoutSub]);
    });
  });
});
