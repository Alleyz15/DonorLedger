ALTER TABLE "Evidence" ALTER COLUMN "status" DROP DEFAULT;

UPDATE "Evidence"
SET "status" = 'PENDING_REVIEW'
WHERE "status" = 'PENDING_AI';

CREATE TYPE "EvidenceStatus_new" AS ENUM (
  'PENDING_REVIEW',
  'APPROVED',
  'CONFIRMED',
  'REJECTED',
  'AUTO_FROZEN'
);

ALTER TABLE "Evidence"
ALTER COLUMN "status" TYPE "EvidenceStatus_new"
USING ("status"::text::"EvidenceStatus_new");

ALTER TYPE "EvidenceStatus" RENAME TO "EvidenceStatus_old";
ALTER TYPE "EvidenceStatus_new" RENAME TO "EvidenceStatus";
DROP TYPE "EvidenceStatus_old";

ALTER TABLE "Evidence" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';
