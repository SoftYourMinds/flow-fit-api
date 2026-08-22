import { Controller, Get, Post, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import type { Request, Response } from 'express';
import type { Update } from 'telegraf/types';
import type { AuthenticatedRequest } from '../../auth/interfaces/jwt-payload.interface';

export interface LinkTokenResponse {
  token: string;
}

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectBot() private readonly bot: Telegraf<Context>,
  ) {}

  // ─── Public Methods ─────────────────────────────────────────────

  @Post('webhook')
  @ApiOperation({ summary: 'Telegram Webhook Endpoint' })
  async handleWebhook(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.bot.handleUpdate(req.body as Update, res);
  }

  @Get('link-token')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a unique token to link Telegram bot' })
  async getLinkToken(@Req() req: AuthenticatedRequest): Promise<LinkTokenResponse> {
    const userId = req.user.id;
    const token = crypto.randomBytes(16).toString('hex');

    await this.prisma.user.update({
      where: { id: userId },
      data: { tgLinkToken: token },
    });

    return { token };
  }
}
