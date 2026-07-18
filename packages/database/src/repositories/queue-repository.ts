import { randomUUID } from "node:crypto";
import { Prisma, QueueItemStatus, type PrismaClient } from "@prisma/client";

export type QueueCreateInput = { name: string; channelIds: string[]; startsAt?: Date; dailyStartTime?: string; dailyEndTime?: string; itemsPerBatch: number; intervalMinutes: number; secondsBetweenItems: number; repeatEnabled: boolean; repeatCooldownHours: number };
export class QueueRepository {
  constructor(private readonly prisma: PrismaClient) {}
  list() { return this.prisma.publishingQueue.findMany({ include: { targets: { include: { channel: true } }, items: { where: { status: { not: "CANCELLED" } }, include: { publication: { include: { product: true } }, deliveries: { orderBy: { createdAt: "desc" } } }, orderBy: [{ priority: "desc" }, { position: "asc" }] } }, orderBy: { createdAt: "desc" } }); }
  findById(id: string) { return this.prisma.publishingQueue.findUnique({ where: { id }, include: { targets: { include: { channel: true } }, items: { include: { publication: { include: { product: true } }, deliveries: true }, orderBy: [{ priority: "desc" }, { position: "asc" }] } } }); }
  listChannels() { return this.prisma.channel.findMany({ where: { isActive: true }, orderBy: [{ platform: "asc" }, { name: "asc" }] }); }
  listPublications() { return this.prisma.publication.findMany({ where: { deletedAt: null, status: { in: ["DRAFT", "QUEUED"] } }, include: { product: true }, orderBy: { createdAt: "desc" } }); }
  create(input: QueueCreateInput) { return this.prisma.publishingQueue.create({ data: { name: input.name, status: "PAUSED", startsAt: input.startsAt, nextRunAt: input.startsAt, dailyStartTime: input.dailyStartTime, dailyEndTime: input.dailyEndTime, itemsPerBatch: input.itemsPerBatch, intervalMinutes: input.intervalMinutes, secondsBetweenItems: input.secondsBetweenItems, repeatEnabled: input.repeatEnabled, repeatCooldownHours: input.repeatCooldownHours, targets: { create: input.channelIds.map((channelId) => ({ channelId })) } } }); }
  async enqueue(queueId: string, publicationId: string, priority = 0, scheduledFor?: Date) { return this.prisma.$transaction(async (tx) => { const aggregate = await tx.queueItem.aggregate({ where: { queueId }, _max: { position: true } }); return tx.queueItem.create({ data: { queueId, publicationId, priority, position: (aggregate._max.position ?? 0) + 1, status: scheduledFor ? QueueItemStatus.SCHEDULED : QueueItemStatus.PENDING, scheduledFor, idempotencyKey: randomUUID() } }); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
  setStatus(id: string, status: "ACTIVE" | "PAUSED" | "COMPLETED") { return this.prisma.publishingQueue.update({ where: { id }, data: { status, pausedAt: status === "PAUSED" ? new Date() : null, nextRunAt: status === "ACTIVE" ? new Date() : undefined, lockToken: null, lockedAt: null } }); }
  setGlobalPause(paused: boolean) { return this.prisma.appSetting.upsert({ where: { key: "publishing.globalPause" }, create: { key: "publishing.globalPause", value: paused }, update: { value: paused } }); }
  async isGloballyPaused() { const setting = await this.prisma.appSetting.findUnique({ where: { key: "publishing.globalPause" } }); return setting?.value === true; }
  async canProcessItem(id: string) { if (await this.isGloballyPaused()) return false; return Boolean(await this.prisma.queueItem.findFirst({ where: { id, status: "PROCESSING", queue: { status: { in: ["ACTIVE", "RUNNING"] } } }, select: { id: true } })); }
  clearPending(queueId: string) { return this.prisma.queueItem.updateMany({ where: { queueId, status: { in: ["PENDING", "SCHEDULED", "PAUSED"] } }, data: { status: "CANCELLED" } }); }
  removePendingPublication(publicationId: string) { return this.prisma.queueItem.updateMany({ where: { publicationId, status: { in: ["PENDING", "SCHEDULED", "PAUSED"] } }, data: { status: "CANCELLED" } }); }
  retryFailedItem(id: string) { return this.prisma.queueItem.updateMany({ where: { id, status: { in: ["FAILED", "PAUSED"] } }, data: { status: "PENDING", availableAt: null, scheduledFor: null } }); }
  updateItem(id: string, data: { status?: QueueItemStatus; priority?: number; position?: number; availableAt?: Date | null; scheduledFor?: Date | null }) { return this.prisma.queueItem.update({ where: { id }, data }); }
  async duplicateItem(id: string) { const source = await this.prisma.queueItem.findUniqueOrThrow({ where: { id } }); return this.enqueue(source.queueId, source.publicationId, source.priority); }
  async reorder(queueId: string, orderedIds: string[]) { await this.prisma.$transaction(orderedIds.map((id, position) => this.prisma.queueItem.updateMany({ where: { id, queueId }, data: { position: position + 1 } }))); }

  async claimDueQueue(now: Date, leaseSeconds = 120) { const token = randomUUID(); return this.prisma.$transaction(async (tx) => { const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "PublishingQueue" WHERE "status" = 'ACTIVE' AND ("startsAt" IS NULL OR "startsAt" <= ${now}) AND ("nextRunAt" IS NULL OR "nextRunAt" <= ${now}) AND ("lockedAt" IS NULL OR "lockedAt" < ${new Date(now.getTime() - leaseSeconds * 1000)}) ORDER BY "nextRunAt" ASC NULLS FIRST FOR UPDATE SKIP LOCKED LIMIT 1`); const row = rows[0]; if (!row) return null; return tx.publishingQueue.update({ where: { id: row.id }, data: { status: "RUNNING", lockToken: token, lockedAt: now }, include: { items: { where: { status: { in: ["PENDING", "SCHEDULED"] }, OR: [{ availableAt: null }, { availableAt: { lte: now } }] }, include: { publication: { include: { product: true } } }, orderBy: [{ priority: "desc" }, { position: "asc" }] } } }); }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }); }
  async scheduleBatch(queueId: string, lockToken: string, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const queue = await tx.publishingQueue.findFirstOrThrow({
        where: { id: queueId, lockToken, status: "RUNNING" },
        include: { items: { where: { AND: [{ OR: [{ status: "PENDING" }, { status: "SCHEDULED", scheduledFor: { lte: now } }] }, { OR: [{ availableAt: null }, { availableAt: { lte: now } }] }] }, include: { publication: true }, orderBy: [{ priority: "desc" }, { position: "asc" }] } },
      });
      const selected: typeof queue.items = []; let lastProductId: string | null | undefined;
      for (const item of queue.items) { if (selected.length >= queue.itemsPerBatch) break; if (lastProductId && item.publication.productId === lastProductId) continue; selected.push(item); lastProductId = item.publication.productId; }
      for (const [index, item] of selected.entries()) await tx.queueItem.update({ where: { id: item.id }, data: { status: "SCHEDULED", scheduledFor: new Date(now.getTime() + index * queue.secondsBetweenItems * 1000) } });
      return selected.map((item, index) => ({ id: item.id, scheduledFor: new Date(now.getTime() + index * queue.secondsBetweenItems * 1000) }));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  releaseQueue(id: string, lockToken: string, nextRunAt: Date) { return this.prisma.publishingQueue.updateMany({ where: { id, lockToken }, data: { status: "ACTIVE", nextRunAt, lockToken: null, lockedAt: null } }); }
  async claimDueItem(now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const stale = new Date(now.getTime() - 120000);
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT qi."id" FROM "QueueItem" qi JOIN "PublishingQueue" q ON q."id" = qi."queueId" WHERE ((qi."status" = 'SCHEDULED' AND qi."scheduledFor" <= ${now}) OR (qi."status" = 'PROCESSING' AND qi."updatedAt" < ${stale})) AND q."status" IN ('ACTIVE', 'RUNNING') ORDER BY qi."scheduledFor" ASC FOR UPDATE OF qi SKIP LOCKED LIMIT 1`);
      if (!rows[0]) return null;
      await tx.queueItem.update({ where: { id: rows[0].id }, data: { status: "PROCESSING" } });
      return tx.queueItem.findUnique({
        where: { id: rows[0].id },
        include: { publication: { include: { product: true } }, queue: { include: { targets: { include: { channel: true } } } }, deliveries: true },
      });
    });
  }
  async finishItem(itemId: string, outcome: "COMPLETED" | "FAILED" | "RETRY", now: Date, retryAt?: Date) { const item = await this.prisma.queueItem.findUniqueOrThrow({ where: { id: itemId }, include: { queue: true } }); if (outcome === "RETRY") return this.updateItem(itemId, { status: "SCHEDULED", scheduledFor: retryAt, availableAt: retryAt }); if (outcome === "FAILED") return this.updateItem(itemId, { status: "FAILED" }); if (!item.queue.repeatEnabled) return this.prisma.queueItem.update({ where: { id: itemId }, data: { status: "COMPLETED", lastPublishedAt: now } }); const aggregate = await this.prisma.queueItem.aggregate({ where: { queueId: item.queueId }, _max: { position: true } }); return this.prisma.queueItem.update({ where: { id: itemId }, data: { status: "PENDING", position: (aggregate._max.position ?? 0) + 1, lastPublishedAt: now, availableAt: new Date(now.getTime() + item.queue.repeatCooldownHours * 3600000), scheduledFor: null } }); }
}
