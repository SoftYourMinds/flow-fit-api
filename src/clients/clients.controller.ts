import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { AuthGuard } from '@nestjs/passport';
import type { Prisma, Client, ClientNote, MetricsHistory } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/interfaces/jwt-payload.interface';

@UseGuards(AuthGuard('jwt'))
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // ─── Public Methods ─────────────────────────────────────────────

  @Get()
  findAll(@Req() req: AuthenticatedRequest): Promise<Client[]> {
    return this.clientsService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.clientsService.findOne(+id, req.user.id);
  }

  @Post()
  create(
    @Body() body: Omit<Prisma.ClientCreateInput, 'trainer'>,
    @Req() req: AuthenticatedRequest,
  ): Promise<Client> {
    return this.clientsService.create(req.user.id, body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: Prisma.ClientUpdateInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<Client> {
    return this.clientsService.update(+id, req.user.id, body);
  }

  @Delete(':id')
  archive(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<Client> {
    return this.clientsService.archive(+id, req.user.id);
  }

  @Post(':id/notes')
  addNote(
    @Param('id') id: string,
    @Body() body: { text: string; links?: string[] },
    @Req() req: AuthenticatedRequest,
  ): Promise<ClientNote> {
    return this.clientsService.addNote(+id, req.user.id, body);
  }

  @Put(':id/notes/:noteId')
  updateNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Body() body: { text: string; links?: string[] },
    @Req() req: AuthenticatedRequest,
  ): Promise<ClientNote> {
    return this.clientsService.updateNote(+id, +noteId, req.user.id, body);
  }

  @Post(':id/metrics')
  addMetric(
    @Param('id') id: string,
    @Body() body: Omit<Prisma.MetricsHistoryCreateInput, 'client'>,
    @Req() req: AuthenticatedRequest,
  ): Promise<MetricsHistory> {
    return this.clientsService.addMetric(+id, req.user.id, body);
  }

  @Put(':id/metrics/:metricId')
  updateMetric(
    @Param('id') id: string,
    @Param('metricId') metricId: string,
    @Body() body: Partial<Omit<Prisma.MetricsHistoryUpdateInput, 'client'>>,
    @Req() req: AuthenticatedRequest,
  ): Promise<MetricsHistory> {
    return this.clientsService.updateMetric(+id, +metricId, req.user.id, body);
  }
}
