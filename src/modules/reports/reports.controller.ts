import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';

@UseGuards(AuthGuard('jwt'))
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('locationId') locationId: string,
    @Req() req: any
  ) {
    const locId = locationId ? parseInt(locationId, 10) : undefined;
    return this.reportsService.getSummary(req.user.id, startDate, endDate, locId);
  }
}
