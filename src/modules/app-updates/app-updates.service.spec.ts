import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { AppUpdatesService } from './app-updates.service';

describe('AppUpdatesService', () => {
  let service: AppUpdatesService;
  let prisma: { user: { findMany: jest.Mock } };
  let telegramService: { sendMessage: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
      },
    };

    telegramService = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppUpdatesService,
        { provide: PrismaService, useValue: prisma },
        { provide: TelegramService, useValue: telegramService },
      ],
    }).compile();

    service = module.get<AppUpdatesService>(AppUpdatesService);
  });

  describe('getLatestUpdate', () => {
    it('should return the latest version (0.2.0)', () => {
      const update = service.getLatestUpdate();
      expect(update).toBeDefined();
      expect(update.version).toBe('0.2.0');
    });
  });

  describe('getAllUpdates', () => {
    it('should return all updates history', () => {
      const updates = service.getAllUpdates();
      expect(updates.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('broadcastTelegramUpdate', () => {
    it('should throw NotFoundException if version is invalid', async () => {
      await expect(service.broadcastTelegramUpdate('9.9.9')).rejects.toThrow(NotFoundException);
    });

    it('should handle zero recipients gracefully', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.broadcastTelegramUpdate();
      expect(result.success).toBe(true);
      expect(result.recipientsCount).toBe(0);
      expect(telegramService.sendMessage).not.toHaveBeenCalled();
    });

    it('should send broadcast message to all users with tgChatId', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 1, tgChatId: '12345' },
        { id: 2, tgChatId: '67890' },
      ]);

      const result = await service.broadcastTelegramUpdate('0.2.0');
      expect(result.success).toBe(true);
      expect(result.recipientsCount).toBe(2);
      expect(telegramService.sendMessage).toHaveBeenCalledTimes(2);
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        '12345',
        expect.stringContaining('Оновлення FlowFit (v0.2.0)'),
      );
    });
  });
});
