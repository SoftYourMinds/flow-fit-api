import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Client, ClientNote, MetricsHistory } from '@prisma/client';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(trainerId: number): Promise<Client[]> {
    return this.prisma.client.findMany({
      where: { trainerId, isActive: true },
      include: {
        _count: {
          select: { notes: true }
        },
        metrics: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, trainerId: number) {
    const client = await this.prisma.client.findFirst({
      where: { id, trainerId },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        metrics: { orderBy: { createdAt: 'desc' } },
        participations: {
          include: { session: { include: { location: true } } },
          orderBy: { session: { startTime: 'desc' } },
          take: 50,
        }
      }
    });
    if (!client) throw new NotFoundException(`Client #${id} not found`);
    return client;
  }

  async create(trainerId: number, data: Omit<Prisma.ClientCreateInput, 'trainer'>): Promise<Client> {
    return this.prisma.client.create({
      data: {
        ...data,
        trainer: { connect: { id: trainerId } },
      },
    });
  }

  async update(id: number, trainerId: number, data: Prisma.ClientUpdateInput): Promise<Client> {
    await this.findOne(id, trainerId); // validation
    return this.prisma.client.update({
      where: { id },
      data,
    });
  }

  async archive(id: number, trainerId: number): Promise<Client> {
    await this.findOne(id, trainerId);
    return this.prisma.client.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Sub-resources
  async addNote(clientId: number, trainerId: number, data: { text: string, links?: string[] }): Promise<ClientNote> {
    await this.findOne(clientId, trainerId);
    return this.prisma.clientNote.create({
      data: {
        text: data.text,
        links: data.links || [],
        client: { connect: { id: clientId } },
      }
    });
  }

  async updateNote(clientId: number, noteId: number, trainerId: number, data: { text: string, links?: string[] }): Promise<ClientNote> {
    await this.findOne(clientId, trainerId);
    const note = await this.prisma.clientNote.findFirst({
      where: { id: noteId, clientId }
    });
    if (!note) throw new NotFoundException(`Note #${noteId} not found`);

    return this.prisma.clientNote.update({
      where: { id: noteId },
      data: {
        text: data.text,
        links: data.links || [],
      }
    });
  }

  async addMetric(clientId: number, trainerId: number, data: Omit<Prisma.MetricsHistoryCreateInput, 'client'>): Promise<MetricsHistory> {
    const client = await this.findOne(clientId, trainerId);
    const metric = await this.prisma.metricsHistory.create({
      data: {
        ...data,
        client: { connect: { id: clientId } },
      }
    });
    // Update current weight on client if provided
    if (data.weight) {
      await this.prisma.client.update({ where: { id: clientId }, data: { currentWeight: data.weight as number } });
    }
    return metric;
  }
}
