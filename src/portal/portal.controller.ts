import { Controller, Get, Param } from '@nestjs/common';
import { PortalService } from './portal.service';

@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('client/:token')
  getClientProfile(@Param('token') token: string) {
    return this.portalService.getClientByShareToken(token);
  }
}
