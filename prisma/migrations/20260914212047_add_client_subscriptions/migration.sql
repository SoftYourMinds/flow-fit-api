-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('SESSIONS_BASED', 'DATE_RANGE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'EXHAUSTED');

-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN     "subscription_id" INTEGER;

-- CreateTable
CREATE TABLE "client_subscriptions" (
    "id" SERIAL NOT NULL,
    "trainer_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "type" "SubscriptionType" NOT NULL DEFAULT 'SESSIONS_BASED',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "total_sessions" INTEGER,
    "used_sessions" INTEGER NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_subscriptions_trainer_id_idx" ON "client_subscriptions"("trainer_id");

-- CreateIndex
CREATE INDEX "client_subscriptions_client_id_idx" ON "client_subscriptions"("client_id");

-- CreateIndex
CREATE INDEX "client_subscriptions_trainer_id_status_idx" ON "client_subscriptions"("trainer_id", "status");

-- CreateIndex
CREATE INDEX "workout_sessions_subscription_id_idx" ON "workout_sessions"("subscription_id");

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "client_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_subscriptions" ADD CONSTRAINT "client_subscriptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
