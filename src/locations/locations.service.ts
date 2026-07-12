import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Location } from '@prisma/client';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

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
    if (!location) throw new NotFoundException(`Location #${id} not found`);
    return location;
  }

  async create(trainerId: number, data: Omit<Prisma.LocationCreateInput, 'trainer'>): Promise<Location> {
    return this.prisma.location.create({
      data: {
        ...data,
        trainer: { connect: { id: trainerId } },
      },
    });
  }

  async update(id: number, trainerId: number, data: Prisma.LocationUpdateInput): Promise<Location> {
    await this.findOne(id, trainerId); // Ensure exists and belongs to trainer
    return this.prisma.location.update({
      where: { id },
      data,
    });
  }

  async remove(id: number, trainerId: number): Promise<Location> {
    await this.findOne(id, trainerId);
    return this.prisma.location.delete({
      where: { id },
    });
  }
}
