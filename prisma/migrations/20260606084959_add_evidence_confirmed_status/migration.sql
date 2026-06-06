-- AlterEnum
ALTER TYPE "EvidenceStatus" ADD VALUE 'CONFIRMED';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;
