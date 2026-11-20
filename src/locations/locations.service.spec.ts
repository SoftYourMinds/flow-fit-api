import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { LocationsService } from './locations.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LocationsService', () => {
  let service: LocationsService;
  let prisma: {
    location: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      location: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LocationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should default maxParticipants to 8 on create when omitted', async () => {
    prisma.location.create.mockResolvedValue({ id: 1, name: 'Studio', maxParticipants: 8 });

    await service.create(1, { name: 'Studio', type: 'STUDIO' });

    const createCall = prisma.location.create.mock.calls[0] as [
      { data: { name: string; maxParticipants: number } },
    ];
    expect(createCall[0].data.name).toBe('Studio');
    expect(createCall[0].data.maxParticipants).toBe(8);
  });

  it('should reject invalid maxParticipants on create', async () => {
    await expect(
      service.create(1, { name: 'Studio', type: 'STUDIO', maxParticipants: 0 }),
    ).rejects.toThrow(BadRequestException);
  });
});
