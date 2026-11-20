import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma, Location } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Public Methods ─────────────────────────────────────────────

  async findAll(trainerId: number): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: { trainerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, trainerId: number): Promise<Location> {
    const location = await this.prisma.location.findFirst({
      where: { id, trainerId },
    });
    if (!location) {
      throw new NotFoundException(`Location #${id} not found`);
    }
    return location;
  }

  async create(
    trainerId: number,
    data: Omit<Prisma.LocationCreateInput, 'trainer'>,
  ): Promise<Location> {
    const maxParticipants = this.normalizeMaxParticipants(data.maxParticipants, 8);

    return this.prisma.location.create({
      data: {
        ...data,
        maxParticipants,
        trainer: { connect: { id: trainerId } },
      },
    });
  }

  async update(id: number, trainerId: number, data: Prisma.LocationUpdateInput): Promise<Location> {
    await this.findOne(id, trainerId); // Ensure exists and belongs to trainer

    const normalizedData: Prisma.LocationUpdateInput = { ...data };
    if (typeof data.maxParticipants === 'number' || typeof data.maxParticipants === 'string') {
      normalizedData.maxParticipants = this.normalizeMaxParticipants(data.maxParticipants);
    }

    return this.prisma.location.update({
      where: { id },
      data: normalizedData,
    });
  }

  async remove(id: number, trainerId: number): Promise<Location> {
    await this.findOne(id, trainerId);
    return this.prisma.location.delete({
      where: { id },
    });
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private normalizeMaxParticipants(value: unknown, fallback?: number): number | undefined {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const parsed = Number(value);
    const isValidCapacity = Number.isInteger(parsed) && parsed >= 1;
    if (!isValidCapacity) {
      throw new BadRequestException('Максимальна кількість учасників локації має бути не менше 1');
    }

    return parsed;
  }
}
