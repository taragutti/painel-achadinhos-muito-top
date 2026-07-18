import type { Prisma, PrismaClient } from "@prisma/client";
export type HistoryFilters = {
  from?: Date;
  to?: Date;
  platform?: "WHATSAPP" | "TELEGRAM";
  status?: "SENT" | "FAILED" | "PROCESSING";
  type?: "PRODUCT" | "ART_LINK" | "FREE_TEXT";
  productId?: string;
  text?: string;
  queueId?: string;
};
export class OperationalRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async dashboard(dayStart: Date, dayEnd: Date) {
    const [
      integrations,
      activeQueue,
      nextItem,
      products,
      pending,
      sentToday,
      failedToday,
      sentByChannel,
    ] = await Promise.all([
      this.prisma.integration.findMany({
        select: { type: true, status: true, displayName: true },
      }),
      this.prisma.publishingQueue.findFirst({
        where: { status: { in: ["ACTIVE", "RUNNING"] } },
        orderBy: { nextRunAt: "asc" },
        select: {
          id: true,
          name: true,
          status: true,
          intervalMinutes: true,
          nextRunAt: true,
        },
      }),
      this.prisma.queueItem.findFirst({
        where: {
          status: { in: ["PENDING", "SCHEDULED"] },
          queue: { status: { in: ["ACTIVE", "RUNNING"] } },
        },
        orderBy: [
          { scheduledFor: "asc" },
          { priority: "desc" },
          { position: "asc" },
        ],
        include: {
          publication: {
            select: {
              title: true,
              type: true,
              platforms: true,
              product: { select: { title: true } },
            },
          },
          queue: { select: { name: true } },
        },
      }),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.publication.count({
        where: {
          deletedAt: null,
          status: { in: ["DRAFT", "QUEUED", "PROCESSING"] },
        },
      }),
      this.prisma.delivery.count({
        where: { status: "SENT", completedAt: { gte: dayStart, lt: dayEnd } },
      }),
      this.prisma.delivery.count({
        where: { status: "FAILED", completedAt: { gte: dayStart, lt: dayEnd } },
      }),
      this.prisma.delivery.groupBy({
        by: ["channelId"],
        where: { status: "SENT" },
        _count: { _all: true },
      }),
    ]);
    const channels = await this.prisma.channel.findMany({
      where: { id: { in: sentByChannel.map((row) => row.channelId) } },
      select: { id: true, platform: true },
    });
    return {
      integrations,
      activeQueue,
      nextItem,
      products,
      pending,
      sentToday,
      failedToday,
      sentByPlatform: sentByChannel.map((row) => ({
        platform:
          channels.find((channel) => channel.id === row.channelId)?.platform ??
          "TELEGRAM",
        total: row._count._all,
      })),
    };
  }
  history(filters: HistoryFilters) {
    const where: Prisma.DeliveryWhereInput = {
      createdAt: { gte: filters.from, lte: filters.to },
      status: filters.status,
      channel: filters.platform ? { platform: filters.platform } : undefined,
      queueItem: {
        queueId: filters.queueId,
        publication: {
          type: filters.type,
          productId: filters.productId,
          OR: filters.text
            ? [
                { title: { contains: filters.text, mode: "insensitive" } },
                {
                  customMessage: {
                    contains: filters.text,
                    mode: "insensitive",
                  },
                },
              ]
            : undefined,
        },
      },
    };
    return this.prisma.delivery.findMany({
      where,
      include: {
        channel: { select: { platform: true, name: true } },
        queueItem: {
          include: {
            queue: { select: { id: true, name: true } },
            publication: {
              include: {
                product: {
                  select: { id: true, title: true, affiliateUrl: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
  }
  getSetting(key: string) {
    return this.prisma.appSetting.findUnique({ where: { key } });
  }
  saveSetting(key: string, value: Prisma.InputJsonValue) {
    return this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
  listSettingsOptions() {
    return Promise.all([
      this.prisma.channel.findMany({
        where: { isActive: true },
        select: { id: true, name: true, platform: true },
      }),
      this.prisma.messageTemplate.findMany({
        where: { isActive: true },
        select: { id: true, name: true, platform: true },
      }),
    ]);
  }
  listHistoryOptions() {
    return Promise.all([
      this.prisma.product.findMany({
        where: { deletedAt: null },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      }),
      this.prisma.publishingQueue.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
  }
}
