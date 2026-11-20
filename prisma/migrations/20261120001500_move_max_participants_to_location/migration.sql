-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "max_participants" INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "workout_sessions" DROP COLUMN "max_participants";

