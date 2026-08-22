import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { AuthGuard } from '@nestjs/passport';
import type { Prisma, Location } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/interfaces/jwt-payload.interface';

@UseGuards(AuthGuard('jwt'))
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // ─── Public Methods ─────────────────────────────────────────────

  @Get()
  findAll(@Req() req: AuthenticatedRequest): Promise<Location[]> {
    return this.locationsService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<Location> {
    return this.locationsService.findOne(+id, req.user.id);
  }

  @Post()
  create(
    @Body() body: Omit<Prisma.LocationCreateInput, 'trainer'>,
    @Req() req: AuthenticatedRequest,
  ): Promise<Location> {
    return this.locationsService.create(req.user.id, body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: Prisma.LocationUpdateInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<Location> {
    return this.locationsService.update(+id, req.user.id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<Location> {
    return this.locationsService.remove(+id, req.user.id);
  }
}
