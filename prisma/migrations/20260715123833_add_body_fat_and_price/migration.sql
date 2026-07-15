/*
  Warnings:

  - You are about to drop the column `price_per_person` on the `workout_sessions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "metrics_history" ADD COLUMN     "body_fat_percentage" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "session_participants" ADD COLUMN     "is_attended" BOOLEAN;

-- AlterTable
ALTER TABLE "workout_sessions" DROP COLUMN "price_per_person",
ADD COLUMN     "price" DOUBLE PRECISION NOT NULL DEFAULT 0;
