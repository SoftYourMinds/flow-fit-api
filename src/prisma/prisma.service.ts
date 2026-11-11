import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.ensureTables();
  }

  private async ensureTables() {
    try {
      await this.$executeRawUnsafe(`
        ALTER TABLE "workout_sessions" ADD COLUMN IF NOT EXISTS "enable_notification" BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE "workout_sessions" ADD COLUMN IF NOT EXISTS "reminder_mode" TEXT NOT NULL DEFAULT 'auto';
        ALTER TABLE "workout_sessions" ADD COLUMN IF NOT EXISTS "is_critical" BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE "workout_sessions" ADD COLUMN IF NOT EXISTS "reminder_sent_at" TIMESTAMP(3);

        CREATE TABLE IF NOT EXISTS "push_subscriptions" (
            "id" SERIAL NOT NULL,
            "user_id" INTEGER NOT NULL,
            "endpoint" TEXT NOT NULL,
            "p256dh" TEXT NOT NULL,
            "auth" TEXT NOT NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
        CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
      `);
      this.logger.log('Database tables & columns verified successfully.');
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(`ensureTables warning: ${error.message}`);
    }
  }
}
