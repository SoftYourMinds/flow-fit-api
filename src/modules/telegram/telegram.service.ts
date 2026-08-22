import { Injectable, Logger } from '@nestjs/common';
import { Update, Start, Ctx, InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';

interface ContextWithPayload extends Context {
  startPayload?: string;
}

@Update()
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectBot() private readonly bot: Telegraf<Context>,
  ) {}

  // ─── Public Methods ─────────────────────────────────────────────

  @Start()
  async startCommand(@Ctx() ctx: Context): Promise<void> {
    const payload = this.extractStartPayload(ctx);
    const chatId = ctx.chat?.id.toString();

    this.logger.log(
      `Received /start command from Chat ID: ${chatId ?? 'none'}, Payload: "${payload ?? ''}"`,
    );

    if (!chatId) {
      this.logger.warn('No chat ID found in context.');
      return;
    }

    try {
      await this.processStartCommand(ctx, chatId, payload);
    } catch (error: unknown) {
      this.logger.error(
        `Error in startCommand for Chat ID: ${chatId}, Payload: "${payload ?? ''}"`,
        error,
      );
      await ctx.reply('❌ Сталася помилка під час підключення. Спробуйте пізніше.');
    }
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (error: unknown) {
      this.logger.error(`Failed to send message to ${chatId}`, error);
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private extractStartPayload(ctx: Context): string | undefined {
    const ctxWithPayload = ctx as ContextWithPayload;
    if (ctxWithPayload.startPayload) {
      return ctxWithPayload.startPayload.trim();
    }

    const message = ctx.message;
    if (message && 'text' in message && typeof message.text === 'string') {
      const parts = message.text.split(' ');
      if (parts.length > 1 && parts[1]) {
        return parts[1].trim();
      }
    }

    return undefined;
  }

  private async processStartCommand(ctx: Context, chatId: string, payload?: string): Promise<void> {
    const existingUser = await this.prisma.user.findFirst({
      where: { tgChatId: chatId },
    });

    if (existingUser && !payload) {
      this.logger.log(
        `User ${existingUser.id} is already connected (Chat ID: ${chatId}). Sent success message.`,
      );
      await ctx.reply(
        `✅ Вітаю, ${existingUser.firstName}! Ваш акаунт вже успішно підключено до FlowFit.`,
      );
      return;
    }

    if (!payload) {
      this.logger.warn(`No payload provided for Chat ID: ${chatId}. Sent invalid link message.`);
      await ctx.reply(
        '❌ Невірне посилання. Щоб підключити бота, використовуйте спеціальне посилання з налаштувань додатку.',
      );
      return;
    }

    await this.linkUserByToken(
      ctx,
      chatId,
      payload,
      Boolean(existingUser),
      existingUser?.firstName,
    );
  }

  private async linkUserByToken(
    ctx: Context,
    chatId: string,
    payload: string,
    hasExistingUser: boolean,
    existingUserName?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { tgLinkToken: payload },
    });

    if (!user) {
      if (hasExistingUser) {
        this.logger.warn(`Invalid token "${payload}" used by already connected User.`);
        await ctx.reply(
          `✅ Вітаю, ${existingUserName ?? ''}! Ваш акаунт вже підключено (старе посилання було проігноровано).`,
        );
        return;
      }

      this.logger.error(
        `Token not found or already used: "${payload}" for Chat ID: ${chatId}. User not connected.`,
      );
      await ctx.reply(
        '❌ Токен недійсний або вже використаний. Спробуйте згенерувати новий у додатку.',
      );
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        tgChatId: chatId,
        tgLinkToken: null,
      },
    });

    await ctx.reply(
      `✅ Вітаю, ${user.firstName}! Бот успішно підключено до вашого акаунту FlowFit. Тепер ви будете отримувати сюди сповіщення та зведення.`,
    );
    this.logger.log(`Telegram bot linked successfully for user ${user.id} (Chat ID: ${chatId})`);
  }
}
