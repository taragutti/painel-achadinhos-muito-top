import type { PrismaClient } from "@prisma/client";
export class DeliveryRepository {
  constructor(private readonly prisma: PrismaClient) {}
  listForItem(queueItemId: string) { return this.prisma.delivery.findMany({ where: { queueItemId }, orderBy: { createdAt: "asc" } }); }
  start(input: { queueItemId: string; channelId: string; attemptNumber: number; idempotencyKey: string; messageSnapshot: string; mediaUrlSnapshot?: string }) { return this.prisma.delivery.upsert({ where: { idempotencyKey: input.idempotencyKey }, create: { ...input, status: "PROCESSING" }, update: {} }); }
  complete(id: string, result: { success: boolean; providerMessageId?: string; errorCode?: string; errorMessage?: string }) { return this.prisma.delivery.update({ where: { id }, data: { status: result.success ? "SENT" : "FAILED", providerMessageId: result.providerMessageId, errorCode: result.errorCode, errorMessage: result.errorMessage?.slice(0, 500), completedAt: new Date() } }); }
}
