import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.locationsService.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.locationsService.findOne(+id, req.user.sub);
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.locationsService.create(req.user.sub, body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.locationsService.update(+id, req.user.sub, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.locationsService.remove(+id, req.user.sub);
  }
}
