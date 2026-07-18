import { Prisma, PublicationStatus, type PrismaClient } from "@prisma/client";

export class PublicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: Prisma.PublicationCreateInput) {
    return this.prisma.publication.create({ data });
  }

  findById(id: string) {
    return this.prisma.publication.findFirst({ where: { id, deletedAt: null }, include: { product: true, template: true, attempts: { orderBy: { createdAt: "desc" } } } });
  }

  listCurrent() {
    return this.prisma.publication.findMany({
      where: { deletedAt: null },
      include: { product: true, template: true, attempts: { orderBy: { createdAt: "desc" }, take: 1 }, queueItems: { where: { status: { not: "CANCELLED" } }, include: { queue: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
  }

  async update(id: string, data: Prisma.PublicationUpdateInput) {
    await this.assertMutable(id);
    return this.prisma.publication.update({ where: { id }, data });
  }

  async softDelete(id: string, deletedAt = new Date()) {
    await this.assertMutable(id);
    return this.prisma.publication.update({
      where: { id },
      data: { deletedAt, status: PublicationStatus.CANCELLED },
    });
  }

  async archive(id: string) { await this.assertMutable(id); return this.prisma.publication.update({ where: { id }, data: { status: PublicationStatus.CANCELLED } }); }

  private async assertMutable(id: string) { const sent = await this.prisma.delivery.findFirst({ where: { status: "SENT", queueItem: { publicationId: id } }, select: { id: true } }); if (sent) throw new Error("Published history is immutable"); }

  async duplicate(id: string) {
    const source = await this.findById(id); if (!source) throw new Error("Publication not found");
    return this.prisma.publication.create({ data: {
      idempotencyKey: crypto.randomUUID(), type: source.type, productId: source.productId,
      title: source.title ? `${source.title} (cópia)` : null, customMessage: source.customMessage,
      destinationLink: source.destinationLink, mediaUrl: source.mediaUrl, couponCode: source.couponCode,
      category: source.category, platforms: source.platforms, templateId: source.templateId,
      metadata: source.metadata as Prisma.InputJsonValue,
    } });
  }
}
