import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('link-token')
  @UseGuards(JwtAuthGuard)
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
