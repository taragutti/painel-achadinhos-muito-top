import { getPrisma, Prisma, ProductRepository, ProductService, PublicationRepository, PublicationService, QueueRepository, QueueService, type Marketplace, type ProductStatus } from "@achadinhos/database";
import type { ProductSaveInput } from "@achadinhos/shared";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";

export async function listProducts(filters: { search?: string; marketplace?: Marketplace; status?: ProductStatus } = {}) {
  await requireAuthenticatedAdmin();
  return new ProductRepository(getPrisma()).listActive(filters);
}

export async function getProduct(id: string) { await requireAuthenticatedAdmin(); return new ProductRepository(getPrisma()).findById(id); }

export async function updateProduct(id: string, input: ProductSaveInput) {
  return new ProductRepository(getPrisma()).update(id, {
    marketplace: input.marketplace, sourceUrl: input.sourceUrl, resolvedUrl: input.resolvedUrl,
    affiliateUrl: input.affiliateUrl, affiliateConfirmed: input.affiliateConfirmed,
    title: input.title, description: input.description,
    oldPrice: input.oldPrice ? new Prisma.Decimal(normalizeMoney(input.oldPrice)!) : null,
    currentPrice: input.currentPrice ? new Prisma.Decimal(normalizeMoney(input.currentPrice)!) : null,
    couponCode: input.couponCode || null, storeName: input.storeName || null,
    originalImageUrl: input.originalImageUrl || null, storedImageUrl: input.storedImageUrl || null,
    thumbnailImageUrl: input.thumbnailImageUrl || null,
    metadata: { internalNotes: input.internalNotes ?? "" }, status: input.status,
  });
}

export async function saveProduct(input: ProductSaveInput, intent: "DRAFT" | "QUEUE", queueId?: string) {
  const prisma = getPrisma();
  const product = await new ProductService(new ProductRepository(prisma)).create({
    ...input,
    oldPrice: normalizeMoney(input.oldPrice),
    currentPrice: normalizeMoney(input.currentPrice),
    originalImageUrl: input.originalImageUrl || undefined,
    storedImageUrl: input.storedImageUrl || undefined,
    thumbnailImageUrl: input.thumbnailImageUrl || undefined,
    status: intent === "QUEUE" ? "ACTIVE" : input.status,
  });
  if (intent === "DRAFT") return { product, queued: false };
  const publication = await new PublicationService(new PublicationRepository(prisma)).create({ type: "PRODUCT", productId: product.id, title: product.title, platforms: ["WHATSAPP", "TELEGRAM"] });
  const queue = queueId ? await prisma.publishingQueue.findUnique({ where: { id: queueId } }) : (await findOrCreateMainQueue())?.queue;
  if (!queue) return { product, publication, queued: false, warning: "Produto salvo, mas nenhuma fila está configurada." };
  const item = await new QueueService(new QueueRepository(prisma)).enqueue(queue.id, publication.id);
  return { product, publication, item, queued: true };
}

export async function findOrCreateMainQueue() {
  const prisma = getPrisma();
  const existing = await prisma.publishingQueue.findFirst({
    where: { status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return { queue: existing, created: false };
  const channel = await prisma.channel.findFirst({
    where: { platform: "WHATSAPP", isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (!channel) return null;
  const queue = await prisma.publishingQueue.create({
    data: {
      name: "Fila principal",
      status: "PAUSED",
      dailyStartTime: "08:00",
      dailyEndTime: "21:30",
      timezone: "America/Sao_Paulo",
      itemsPerBatch: 1,
      intervalMinutes: 20,
      secondsBetweenItems: 30,
      repeatEnabled: false,
      repeatCooldownHours: 24,
      targets: { create: { channelId: channel.id } },
    },
  });
  return { queue, created: true };
}

function normalizeMoney(value?: string) { return value ? value.replace(",", ".") : undefined; }
