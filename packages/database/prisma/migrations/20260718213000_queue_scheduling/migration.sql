ALTER TYPE "QueueItemStatus" ADD VALUE IF NOT EXISTS 'PAUSED';

ALTER TABLE "PublishingQueue"
ADD COLUMN "startsAt" TIMESTAMP(3),
ADD COLUMN "repeatEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "repeatCooldownHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN "lockToken" TEXT,
ADD COLUMN "lockedAt" TIMESTAMP(3);

ALTER TABLE "QueueItem"
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "availableAt" TIMESTAMP(3),
ADD COLUMN "lastPublishedAt" TIMESTAMP(3);

ALTER TABLE "Delivery"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "messageSnapshot" TEXT,
ADD COLUMN "mediaUrlSnapshot" TEXT;

UPDATE "Delivery"
SET "idempotencyKey" = CONCAT('legacy:', "id"),
    "messageSnapshot" = '[mensagem histórica não disponível]'
WHERE "idempotencyKey" IS NULL OR "messageSnapshot" IS NULL;

ALTER TABLE "Delivery" ALTER COLUMN "idempotencyKey" SET NOT NULL;
ALTER TABLE "Delivery" ALTER COLUMN "messageSnapshot" SET NOT NULL;

CREATE UNIQUE INDEX "Delivery_idempotencyKey_key" ON "Delivery"("idempotencyKey");
CREATE INDEX "PublishingQueue_lockedAt_idx" ON "PublishingQueue"("lockedAt");
CREATE INDEX "QueueItem_priority_position_idx" ON "QueueItem"("priority", "position");
CREATE INDEX "QueueItem_availableAt_idx" ON "QueueItem"("availableAt");
