import { Injectable, Logger } from '@nestjs/common';
import { Update, Start, Ctx, InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';

@Update()
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectBot() private readonly bot: Telegraf<Context>
  ) {}

  @Start()
  async startCommand(@Ctx() ctx: Context) {
    const message = ctx.message as any;
    // Extract token from command, e.g. "/start <token>"
    const payload = message?.text?.split(' ')[1];
    const chatId = ctx.chat?.id.toString();

    if (!payload || !chatId) {
      await ctx.reply('❌ Невірне посилання. Щоб підключити бота, використовуйте спеціальне посилання з налаштувань додатку.');
      return;
    }

    try {
      // Find user by tgLinkToken
      const user = await this.prisma.user.findUnique({
        where: { tgLinkToken: payload }
      });

      if (!user) {
        await ctx.reply('❌ Токен недійсний або вже використаний. Спробуйте згенерувати новий у додатку.');
        return;
      }

      // Update user with tgChatId and clear token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          tgChatId: chatId,
          tgLinkToken: null
        }
      });

      await ctx.reply(`✅ Вітаю, ${user.firstName}! Бот успішно підключено до вашого акаунту FlowFit. Тепер ви будете отримувати сюди сповіщення та зведення.`);
      this.logger.log(`Telegram bot linked for user ${user.id} (Chat ID: ${chatId})`);

    } catch (error) {
      this.logger.error('Error in startCommand', error);
      await ctx.reply('❌ Сталася помилка під час підключення. Спробуйте пізніше.');
    }
  }

  // --- Utility methods for sending messages ---

  async sendMessage(chatId: string, text: string) {
    try {
      await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Failed to send message to ${chatId}`, error);
    }
  }
}
