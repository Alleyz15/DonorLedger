-- AlterTable
ALTER TABLE "NGO" ADD COLUMN     "adminPercent" INTEGER,
ADD COLUMN     "aidPercent" INTEGER,
ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "causeType" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "directors" JSONB,
ADD COLUMN     "financialDoc" TEXT,
ADD COLUMN     "logisticsPercent" INTEGER,
ADD COLUMN     "registeredAddress" TEXT,
ADD COLUMN     "registrationDoc" TEXT,
ADD COLUMN     "registrationType" TEXT;
