-- Complete domain model for Painel Achadinhos Muito Top.
-- This migration preserves existing rows and historical publication attempts.
-- Review and back up the target database before applying it outside development.

CREATE TYPE "UserRole" AS ENUM ('ADMIN');
CREATE TYPE "Marketplace" AS ENUM ('AMAZON', 'ALIEXPRESS', 'MAGALU', 'MERCADO_LIVRE', 'SHEIN', 'SHOPEE', 'OTHER');
CREATE TYPE "PublicationType" AS ENUM ('PRODUCT', 'ART_LINK', 'FREE_TEXT');
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
ALTER TYPE "PublicationChannel" RENAME TO "Platform";
CREATE TYPE "TemplatePlatform" AS ENUM ('WHATSAPP', 'TELEGRAM', 'BOTH');
CREATE TYPE "QueueStatus" AS ENUM ('ACTIVE', 'PAUSED', 'RUNNING', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "QueueItemStatus" AS ENUM ('PENDING', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "IntegrationType" AS ENUM ('WHATSAPP', 'TELEGRAM');
CREATE TYPE "IntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'ERROR', 'DISABLED');

-- Evolve the administrator table without replacing accounts or password hashes.
ALTER TABLE "AdminUser" RENAME TO "User";
ALTER TABLE "User" RENAME COLUMN "active" TO "isActive";
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" RENAME CONSTRAINT "AdminUser_pkey" TO "User_pkey";
ALTER INDEX "AdminUser_email_key" RENAME TO "User_email_key";
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

ALTER TABLE "AdminSession" DROP CONSTRAINT "AdminSession_adminId_fkey";
ALTER TABLE "AdminSession" RENAME COLUMN "adminId" TO "userId";
ALTER INDEX "AdminSession_adminId_expiresAt_idx" RENAME TO "AdminSession_userId_expiresAt_idx";
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reuse and enrich existing product data.
ALTER TABLE "Product" RENAME COLUMN "name" TO "title";
ALTER TABLE "Product" RENAME COLUMN "store" TO "storeName";
ALTER TABLE "Product" RENAME COLUMN "price" TO "currentPrice";
ALTER TABLE "Product" RENAME COLUMN "imageUrl" TO "storedImageUrl";
ALTER TABLE "Product" ALTER COLUMN "currentPrice" DROP NOT NULL;
ALTER TABLE "Product" ADD COLUMN "marketplace" "Marketplace" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Product" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "resolvedUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "affiliateConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL';
ALTER TABLE "Product" ADD COLUMN "discountPercentage" INTEGER;
ALTER TABLE "Product" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "Product" ADD COLUMN "originalImageUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Product" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Product" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "Product" SET "sourceUrl" = "affiliateUrl", "resolvedUrl" = "affiliateUrl";
ALTER TABLE "Product" ALTER COLUMN "sourceUrl" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "resolvedUrl" SET NOT NULL;
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");

-- Publications become polymorphic and retain existing content and idempotency keys.
ALTER TABLE "Publication" DROP CONSTRAINT "Publication_productId_fkey";
ALTER TABLE "Publication" RENAME COLUMN "destination" TO "destinationLink";
ALTER TABLE "Publication" RENAME COLUMN "renderedText" TO "customMessage";
ALTER TABLE "Publication" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "Publication" ALTER COLUMN "channel" DROP NOT NULL;
ALTER TABLE "Publication" ALTER COLUMN "destinationLink" DROP NOT NULL;
ALTER TABLE "Publication" ALTER COLUMN "customMessage" DROP NOT NULL;
ALTER TABLE "Publication" ADD COLUMN "type" "PublicationType" NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE "Publication" ADD COLUMN "title" TEXT;
ALTER TABLE "Publication" ADD COLUMN "mediaUrl" TEXT;
ALTER TABLE "Publication" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
DROP INDEX "Publication_status_scheduledAt_idx";
CREATE INDEX "Publication_status_idx" ON "Publication"("status");
CREATE INDEX "Publication_scheduledAt_idx" ON "Publication"("scheduledAt");
CREATE INDEX "Publication_createdAt_idx" ON "Publication"("createdAt");
CREATE INDEX "Publication_deletedAt_idx" ON "Publication"("deletedAt");

ALTER TABLE "PublicationAttempt" DROP CONSTRAINT "PublicationAttempt_publicationId_fkey";
ALTER TABLE "PublicationAttempt" ADD CONSTRAINT "PublicationAttempt_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Convert the original template table into platform-aware message templates.
ALTER TABLE "Template" RENAME TO "MessageTemplate";
ALTER TABLE "MessageTemplate" RENAME COLUMN "body" TO "content";
ALTER TABLE "MessageTemplate" RENAME COLUMN "active" TO "isActive";
ALTER TABLE "MessageTemplate" ADD COLUMN "platform" "TemplatePlatform" NOT NULL DEFAULT 'BOTH';
ALTER TABLE "MessageTemplate" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MessageTemplate" RENAME CONSTRAINT "Template_pkey" TO "MessageTemplate_pkey";
CREATE INDEX "MessageTemplate_platform_isActive_idx" ON "MessageTemplate"("platform", "isActive");
CREATE INDEX "MessageTemplate_createdAt_idx" ON "MessageTemplate"("createdAt");

CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublishingQueue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'PAUSED',
    "intervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "itemsPerBatch" INTEGER NOT NULL DEFAULT 1,
    "secondsBetweenItems" INTEGER NOT NULL DEFAULT 30,
    "dailyStartTime" VARCHAR(5),
    "dailyEndTime" VARCHAR(5),
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "nextRunAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PublishingQueue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QueueItem" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "QueueItemStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QueueItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QueueTarget" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QueueTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "queueItemId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "encryptedCredentials" TEXT,
    "lastConnectionAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Channel_platform_isActive_idx" ON "Channel"("platform", "isActive");
CREATE INDEX "Channel_createdAt_idx" ON "Channel"("createdAt");
CREATE INDEX "PublishingQueue_status_idx" ON "PublishingQueue"("status");
CREATE INDEX "PublishingQueue_nextRunAt_idx" ON "PublishingQueue"("nextRunAt");
CREATE INDEX "PublishingQueue_createdAt_idx" ON "PublishingQueue"("createdAt");
CREATE UNIQUE INDEX "QueueItem_idempotencyKey_key" ON "QueueItem"("idempotencyKey");
CREATE UNIQUE INDEX "QueueItem_queueId_position_key" ON "QueueItem"("queueId", "position");
CREATE INDEX "QueueItem_status_idx" ON "QueueItem"("status");
CREATE INDEX "QueueItem_scheduledFor_idx" ON "QueueItem"("scheduledFor");
CREATE INDEX "QueueItem_position_idx" ON "QueueItem"("position");
CREATE INDEX "QueueItem_createdAt_idx" ON "QueueItem"("createdAt");
CREATE UNIQUE INDEX "QueueTarget_queueId_channelId_key" ON "QueueTarget"("queueId", "channelId");
CREATE INDEX "QueueTarget_createdAt_idx" ON "QueueTarget"("createdAt");
CREATE UNIQUE INDEX "Delivery_queueItemId_channelId_attemptNumber_key" ON "Delivery"("queueItemId", "channelId", "attemptNumber");
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");
CREATE INDEX "Delivery_createdAt_idx" ON "Delivery"("createdAt");
CREATE UNIQUE INDEX "Integration_type_key" ON "Integration"("type");
CREATE INDEX "Integration_status_idx" ON "Integration"("status");
CREATE INDEX "Integration_createdAt_idx" ON "Integration"("createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_queueId_fkey"
  FOREIGN KEY ("queueId") REFERENCES "PublishingQueue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QueueTarget" ADD CONSTRAINT "QueueTarget_queueId_fkey"
  FOREIGN KEY ("queueId") REFERENCES "PublishingQueue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QueueTarget" ADD CONSTRAINT "QueueTarget_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_queueItemId_fkey"
  FOREIGN KEY ("queueItemId") REFERENCES "QueueItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
