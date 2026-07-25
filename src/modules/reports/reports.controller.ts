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
    @Query('workoutTypes') workoutTypes: string | string[],
    @Req() req: any
  ) {
    const locId = locationId ? parseInt(locationId, 10) : undefined;
    
    // Normalize workoutTypes to an array of strings if provided
    let typesArray: string[] | undefined;
    if (workoutTypes) {
      typesArray = Array.isArray(workoutTypes) ? workoutTypes : [workoutTypes];
    }
    
    return this.reportsService.getSummary(req.user.id, startDate, endDate, locId, typesArray);
  }
}
