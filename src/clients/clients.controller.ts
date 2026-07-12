import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.clientsService.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.clientsService.findOne(+id, req.user.sub);
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.clientsService.create(req.user.sub, body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.clientsService.update(+id, req.user.sub, body);
  }

  @Delete(':id')
  archive(@Param('id') id: string, @Req() req: any) {
    // Soft-delete as per requirements
    return this.clientsService.archive(+id, req.user.sub);
  }

  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.clientsService.addNote(+id, req.user.sub, body);
  }

  @Post(':id/metrics')
  addMetric(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.clientsService.addMetric(+id, req.user.sub, body);
  }
}
