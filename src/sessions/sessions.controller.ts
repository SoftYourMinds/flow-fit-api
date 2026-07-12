import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionQueryDto } from './dto/session-query.dto';
import { AddParticipantDto } from './dto/add-participant.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@Body() dto: CreateSessionDto, @Req() req: any) {
    return this.sessionsService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Query() query: SessionQueryDto, @Req() req: any) {
    return this.sessionsService.findAll(req.user.id, query);
  }

  @Post('duplicate-week')
  duplicateWeek(
    @Body('sourceStart') sourceStart: string,
    @Body('targetStart') targetStart: string,
    @Req() req: any,
  ) {
    return this.sessionsService.duplicateWeek(req.user.id, sourceStart, targetStart);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.sessionsService.findOne(+id, req.user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSessionDto, @Req() req: any) {
    return this.sessionsService.update(req.user.id, +id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.sessionsService.remove(req.user.id, +id);
  }

  @Post(':id/participants')
  addParticipant(@Param('id') id: string, @Body() dto: AddParticipantDto, @Req() req: any) {
    return this.sessionsService.addParticipant(req.user.id, +id, dto);
  }

  @Delete(':id/participants/:participantId')
  removeParticipant(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @Req() req: any,
  ) {
    return this.sessionsService.removeParticipant(req.user.id, +id, +participantId);
  }
}
