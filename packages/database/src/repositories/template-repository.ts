import { type Prisma, type PrismaClient, type TemplatePlatform } from "@prisma/client";

export class TemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}
  listActive() { return this.prisma.messageTemplate.findMany({ where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }); }
  listAll() { return this.prisma.messageTemplate.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }); }
  create(data: Prisma.MessageTemplateCreateInput) { return this.prisma.$transaction(async (tx) => {
    if (data.isDefault) await clearDefaults(tx, data.platform as TemplatePlatform);
    return tx.messageTemplate.create({ data });
  }); }
  update(id: string, data: Prisma.MessageTemplateUpdateInput, platform?: TemplatePlatform) { return this.prisma.$transaction(async (tx) => {
    if (data.isDefault === true && platform) await clearDefaults(tx, platform, id);
    return tx.messageTemplate.update({ where: { id }, data });
  }); }
}

async function clearDefaults(tx: Prisma.TransactionClient, platform: TemplatePlatform, exceptId?: string) {
  const compatible = platform === "BOTH" ? ["BOTH"] as TemplatePlatform[] : [platform, "BOTH"] as TemplatePlatform[];
  await tx.messageTemplate.updateMany({ where: { platform: { in: compatible }, id: exceptId ? { not: exceptId } : undefined }, data: { isDefault: false } });
}
