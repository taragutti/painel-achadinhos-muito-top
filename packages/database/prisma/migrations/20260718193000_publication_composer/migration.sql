-- Add publication composition fields while preserving existing publications.
CREATE TYPE "MessageCategory" AS ENUM ('SIMPLE', 'LINK', 'NOTICE', 'COUPON', 'INVITATION', 'GROUP_RULES');

ALTER TABLE "Publication" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "Publication" ADD COLUMN "category" "MessageCategory";
ALTER TABLE "Publication" ADD COLUMN "platforms" "Platform"[] NOT NULL DEFAULT ARRAY[]::"Platform"[];
ALTER TABLE "Publication" ADD COLUMN "templateId" TEXT;
ALTER TABLE "Publication" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';
UPDATE "Publication" SET "platforms" = ARRAY["channel"]::"Platform"[] WHERE "channel" IS NOT NULL;

CREATE INDEX "Publication_templateId_idx" ON "Publication"("templateId");
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
