-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TRAINER');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('STUDIO', 'GYM', 'OUTDOOR');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('INDIVIDUAL', 'GROUP');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'REQUIRED_ACTION', 'COMPLETED', 'MISSED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TRAINER',
    "tg_chat_id" TEXT,
    "hashed_refresh_token" TEXT,
    "tg_link_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "trainer_id" INTEGER NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "goal" TEXT,
    "personal_info" TEXT,
    "current_weight" DOUBLE PRECISION,
    "comments" TEXT,
    "g_drive_folder_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_notes" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics_history" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "measurements" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" SERIAL NOT NULL,
    "trainer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL DEFAULT 'STUDIO',
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" SERIAL NOT NULL,
    "trainer_id" INTEGER NOT NULL,
    "location_id" INTEGER NOT NULL,
    "type" "SessionType" NOT NULL DEFAULT 'INDIVIDUAL',
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "price_per_person" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "SessionStatus" NOT NULL DEFAULT 'UPCOMING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_participants" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "client_id" INTEGER,
    "custom_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_tg_link_token_key" ON "users"("tg_link_token");

-- CreateIndex
CREATE INDEX "clients_trainer_id_idx" ON "clients"("trainer_id");

-- CreateIndex
CREATE INDEX "client_notes_client_id_idx" ON "client_notes"("client_id");

-- CreateIndex
CREATE INDEX "metrics_history_client_id_idx" ON "metrics_history"("client_id");

-- CreateIndex
CREATE INDEX "locations_trainer_id_idx" ON "locations"("trainer_id");

-- CreateIndex
CREATE INDEX "workout_sessions_trainer_id_idx" ON "workout_sessions"("trainer_id");

-- CreateIndex
CREATE INDEX "workout_sessions_trainer_id_start_time_idx" ON "workout_sessions"("trainer_id", "start_time");

-- CreateIndex
CREATE INDEX "workout_sessions_status_idx" ON "workout_sessions"("status");

-- CreateIndex
CREATE INDEX "session_participants_session_id_idx" ON "session_participants"("session_id");

-- CreateIndex
CREATE INDEX "session_participants_client_id_idx" ON "session_participants"("client_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics_history" ADD CONSTRAINT "metrics_history_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
