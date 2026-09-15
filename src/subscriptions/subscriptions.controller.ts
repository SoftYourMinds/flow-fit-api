import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CreateSubscriptionWithRecurringDto } from './dto/create-subscription-with-recurring.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionQueryDto } from './dto/subscription-query.dto';
import type { AuthenticatedRequest } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Subscriptions')
@UseGuards(AuthGuard('jwt'))
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // ─── Public Methods ─────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a client subscription' })
  @ApiResponse({ status: 201, description: 'Subscription created' })
  create(@Body() dto: CreateSubscriptionDto, @Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.create(req.user.id, dto);
  }

  @Post('with-recurring')
  @ApiOperation({ summary: 'Create a subscription and generate recurring sessions atomically' })
  @ApiResponse({ status: 201, description: 'Subscription and sessions created' })
  createWithRecurring(
    @Body() dto: CreateSubscriptionWithRecurringDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.createWithRecurring(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all subscriptions' })
  findAll(@Query() query: SubscriptionQueryDto, @Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.findAll(req.user.id, query);
  }

  @Get('client/:clientId/active')
  @ApiOperation({ summary: 'Get active subscriptions for a specific client' })
  getActiveForClient(@Param('clientId') clientId: string, @Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.getActiveForClient(req.user.id, +clientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subscription by ID' })
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.findOne(req.user.id, +id);
  }

  @Get(':id/sessions')
  @ApiOperation({ summary: 'Get all workout sessions linked to a subscription' })
  getSubscriptionSessions(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.getSubscriptionSessions(req.user.id, +id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a subscription' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.update(req.user.id, +id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subscription' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.remove(req.user.id, +id);
  }

  @Post(':id/deduct/:sessionId')
  @ApiOperation({ summary: 'Deduct a session from a subscription' })
  @ApiResponse({ status: 200, description: 'Session deducted from subscription' })
  deductSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.deductSession(req.user.id, +id, +sessionId);
  }

  @Delete(':id/sessions/:sessionId')
  @ApiOperation({ summary: 'Unlink a session from a subscription' })
  @ApiResponse({ status: 200, description: 'Session unlinked and subscription usage recalculated' })
  unlinkSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.unlinkSession(req.user.id, +id, +sessionId);
  }

  @Post(':id/reconcile')
  @ApiOperation({ summary: 'Reconcile subscription usage with actual sessions count' })
  @ApiResponse({ status: 200, description: 'Subscription usage reconciled' })
  reconcile(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.recalculateSubscriptionUsage(req.user.id, +id);
  }
}
