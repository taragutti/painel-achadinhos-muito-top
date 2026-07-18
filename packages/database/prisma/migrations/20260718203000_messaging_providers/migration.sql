ALTER TYPE "IntegrationStatus" ADD VALUE IF NOT EXISTS 'WAITING_QR';

ALTER TABLE "Integration"
ADD COLUMN "displayName" TEXT,
ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX "Delivery_queueItemId_channelId_idx" ON "Delivery"("queueItemId", "channelId");
