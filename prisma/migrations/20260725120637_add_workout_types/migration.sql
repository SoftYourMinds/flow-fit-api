-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN     "workout_types" TEXT[] DEFAULT ARRAY[]::TEXT[];
