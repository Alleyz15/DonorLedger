-- Add unified frontend user accounts for donor signup/login.

CREATE TYPE "UserRole" AS ENUM ('DONOR', 'ORGANIZER', 'BANK_ADMIN');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DONOR',
    "ngoId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_ngoId_idx" ON "User"("ngoId");

ALTER TABLE "User"
ADD CONSTRAINT "User_ngoId_fkey"
FOREIGN KEY ("ngoId") REFERENCES "NGO"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
