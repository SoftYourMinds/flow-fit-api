import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { APP_UPDATES_DATA, AppReleaseUpdate } from './data/app-updates.data';

export interface BroadcastResult {
  success: boolean;
  recipientsCount: number;
  version: string;
}

@Injectable()
export class AppUpdatesService {
  private readonly logger = new Logger(AppUpdatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  // ─── Public Methods ─────────────────────────────────────────────

  getLatestUpdate(): AppReleaseUpdate {
    return APP_UPDATES_DATA[0];
  }

  getAllUpdates(): AppReleaseUpdate[] {
    return APP_UPDATES_DATA;
  }

  async broadcastTelegramUpdate(version?: string): Promise<BroadcastResult> {
    const targetUpdate = this.resolveTargetUpdate(version);
    const recipients = await this.findTelegramRecipients();

    const noRecipientsFound = recipients.length === 0;
    if (noRecipientsFound) {
      this.logger.warn('No trainers found with connected Telegram chat ID.');
      return { success: true, recipientsCount: 0, version: targetUpdate.version };
    }

    const message = this.buildTelegramMessage(targetUpdate);
    await this.dispatchTelegramMessages(recipients, message);

    this.logger.log(
      `Broadcast for version ${targetUpdate.version} sent to ${recipients.length} recipients.`,
    );

    return {
      success: true,
      recipientsCount: recipients.length,
      version: targetUpdate.version,
    };
  }

  // ─── Business Logic ─────────────────────────────────────────────

  private resolveTargetUpdate(version?: string): AppReleaseUpdate {
    if (!version) {
      return this.getLatestUpdate();
    }

    const foundUpdate = APP_UPDATES_DATA.find((item) => item.version === version);
    if (!foundUpdate) {
      throw new NotFoundException(`Оновлення версії "${version}" не знайдено.`);
    }

    return foundUpdate;
  }

  private async findTelegramRecipients(): Promise<Array<{ id: number; tgChatId: string }>> {
    const users = await this.prisma.user.findMany({
      where: {
        tgChatId: {
          not: null,
        },
      },
      select: {
        id: true,
        tgChatId: true,
      },
    });

    return users.filter(
      (user): user is { id: number; tgChatId: string } =>
        typeof user.tgChatId === 'string' && user.tgChatId.length > 0,
    );
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private buildTelegramMessage(update: AppReleaseUpdate): string {
    const lines: string[] = [`🚀 <b>${update.title}</b>\n`];

    for (const group of update.groups) {
      lines.push(`<b>${group.category}</b>`);
      for (const item of group.items) {
        lines.push(`• ${item}`);
      }
      lines.push('');
    }

    lines.push('<i>З повагою, команда FlowFit!</i>');

    return lines.join('\n');
  }

  private async dispatchTelegramMessages(
    recipients: Array<{ id: number; tgChatId: string }>,
    message: string,
  ): Promise<void> {
    for (const recipient of recipients) {
      await this.telegramService.sendMessage(recipient.tgChatId, message);
    }
  }
}
