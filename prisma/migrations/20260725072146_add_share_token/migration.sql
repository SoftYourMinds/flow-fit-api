/*
  Warnings:

  - A unique constraint covering the columns `[share_token]` on the table `clients` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "share_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clients_share_token_key" ON "clients"("share_token");
