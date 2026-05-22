-- CreateEnum
CREATE TYPE "NGOStatus" AS ENUM ('PENDING_KYC', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'FROZEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('PENDING_KYC', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VendorServiceType" AS ENUM ('FOOD', 'LOGISTICS', 'MEDICAL', 'CONSTRUCTION', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING_AI', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'AUTO_FROZEN');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('BANK_ISLAM_DASHBOARD', 'MACC_WEBHOOK');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('KYC_REVIEWER', 'DISBURSEMENT_APPROVER', 'SUPER_ADMIN');

-- CreateTable
CREATE TABLE "NGO" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNum" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "riskTier" "RiskTier" NOT NULL DEFAULT 'MEDIUM',
    "status" "NGOStatus" NOT NULL DEFAULT 'PENDING_KYC',
    "kycNotes" TEXT,
    "kycApprovedBy" TEXT,
    "kycApprovedAt" TIMESTAMP(3),
    "onChainExpiry" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NGO_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "ngoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "causeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "aidPercent" INTEGER NOT NULL,
    "logisticsPercent" INTEGER NOT NULL,
    "adminPercent" INTEGER NOT NULL,
    "targetAmount" DECIMAL(18,2) NOT NULL,
    "raisedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "donorCount" INTEGER NOT NULL DEFAULT 0,
    "endDate" TIMESTAMP(3) NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "deployTxHash" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "pausedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "ngoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ssmNumber" TEXT NOT NULL,
    "serviceType" "VendorServiceType" NOT NULL,
    "bankAccount" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "registrationDoc" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'PENDING_KYC',
    "kycNotes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "donorHash" TEXT NOT NULL,
    "donorEmail" TEXT NOT NULL,
    "donorName" TEXT,
    "campaignId" TEXT NOT NULL,
    "vendorId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "duitNowRef" TEXT,
    "txHash" TEXT,
    "trackerUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "onChainId" INTEGER,
    "campaignId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "ssmDoc" TEXT,
    "serviceAgreement" TEXT,
    "invoice" TEXT,
    "deliveryProof" TEXT,
    "recipientConfirm" TEXT,
    "packageHash" TEXT NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING_AI',
    "aiConfidenceScore" INTEGER,
    "aiReason" TEXT,
    "aiRecommendation" TEXT,
    "aiFlaggedPatterns" JSONB,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "evidenceId" TEXT,
    "channel" "AlertChannel" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'KYC_REVIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CampaignVendors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "NGO_registrationNum_key" ON "NGO"("registrationNum");

-- CreateIndex
CREATE UNIQUE INDEX "NGO_walletAddress_key" ON "NGO"("walletAddress");

-- CreateIndex
CREATE INDEX "NGO_status_idx" ON "NGO"("status");

-- CreateIndex
CREATE INDEX "NGO_walletAddress_idx" ON "NGO"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_contractAddress_key" ON "Campaign"("contractAddress");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_ngoId_idx" ON "Campaign"("ngoId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_walletAddress_key" ON "Vendor"("walletAddress");

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE INDEX "Vendor_ngoId_idx" ON "Vendor"("ngoId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_donorHash_key" ON "Donation"("donorHash");

-- CreateIndex
CREATE INDEX "Donation_campaignId_idx" ON "Donation"("campaignId");

-- CreateIndex
CREATE INDEX "Donation_donorEmail_idx" ON "Donation"("donorEmail");

-- CreateIndex
CREATE INDEX "Evidence_campaignId_idx" ON "Evidence"("campaignId");

-- CreateIndex
CREATE INDEX "Evidence_status_idx" ON "Evidence"("status");

-- CreateIndex
CREATE INDEX "Alert_channel_delivered_idx" ON "Alert"("channel", "delivered");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "_CampaignVendors_AB_unique" ON "_CampaignVendors"("A", "B");

-- CreateIndex
CREATE INDEX "_CampaignVendors_B_index" ON "_CampaignVendors"("B");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ngoId_fkey" FOREIGN KEY ("ngoId") REFERENCES "NGO"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_ngoId_fkey" FOREIGN KEY ("ngoId") REFERENCES "NGO"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CampaignVendors" ADD CONSTRAINT "_CampaignVendors_A_fkey" FOREIGN KEY ("A") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CampaignVendors" ADD CONSTRAINT "_CampaignVendors_B_fkey" FOREIGN KEY ("B") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
