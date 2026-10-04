-- AlterTable
ALTER TABLE "MembershipSeason" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "MembershipSeason" ADD COLUMN "closedAt" DATETIME;
