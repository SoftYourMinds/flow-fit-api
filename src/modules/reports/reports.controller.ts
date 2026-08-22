import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import type { ReportSummaryResponse } from './reports.service';
import type { AuthenticatedRequest } from '../../auth/interfaces/jwt-payload.interface';

@UseGuards(AuthGuard('jwt'))
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ─── Public Methods ─────────────────────────────────────────────

  @Get('summary')
  getSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('locationId') locationId: string | undefined,
    @Query('workoutTypes') workoutTypes: string | string[] | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<ReportSummaryResponse> {
    const locId = locationId ? parseInt(locationId, 10) : undefined;

    let typesArray: string[] | undefined;
    if (workoutTypes) {
      typesArray = Array.isArray(workoutTypes) ? workoutTypes : [workoutTypes];
    }

    return this.reportsService.getSummary(req.user.id, startDate, endDate, locId, typesArray);
  }
}
