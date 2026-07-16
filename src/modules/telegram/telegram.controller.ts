import { Controller, Get, Post, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectBot() private readonly bot: Telegraf<Context>
  ) {}

  @Post('webhook')
  @ApiOperation({ summary: 'Telegram Webhook Endpoint' })
  async handleWebhook(@Req() req: any, @Res() res: any) {
    // Pass the webhook payload to Telegraf to process
    await this.bot.handleUpdate(req.body, res);
  }

  @Get('link-token')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a unique token to link Telegram bot' })
  async getLinkToken(@Req() req: any) {
    const userId = req.user.id;

    // Generate a random token
    const token = crypto.randomBytes(16).toString('hex');

    await this.prisma.user.update({
      where: { id: userId },
      data: { tgLinkToken: token }
    });

    return { token };
  }
}
