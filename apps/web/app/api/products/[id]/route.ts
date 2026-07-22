import { getPrisma, ProductRepository, PublicationRepository, PublicationService, QueueRepository, QueueService } from "@achadinhos/database";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { hasValidRequestOrigin } from "@/lib/auth/request";
import { productSaveInputSchema } from "@achadinhos/shared";
import { findOrCreateMainQueue, updateProduct } from "@/lib/products/application";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { product?: unknown; intent?: unknown } | null;
  const parsed = productSaveInputSchema.safeParse(body?.product);
  if (!parsed.success || (body?.intent !== "DRAFT" && body?.intent !== "QUEUE")) return NextResponse.json({ error: "Revise os campos informados." }, { status: 400 });
  try {
    const product = await updateProduct(id, { ...parsed.data, status: body.intent === "QUEUE" ? "ACTIVE" : parsed.data.status });
    if (body.intent === "DRAFT") return NextResponse.json({ product, queued: false });
    const prisma = getPrisma();
    const publication = await new PublicationService(new PublicationRepository(prisma)).create({ type: "PRODUCT", productId: id, title: product.title, platforms: ["WHATSAPP", "TELEGRAM"] });
    const queue = (await findOrCreateMainQueue())?.queue;
    if (!queue) return NextResponse.json({ product, publication, queued: false, warning: "Produto atualizado, mas nenhuma fila está configurada." });
    const item = await new QueueService(new QueueRepository(prisma)).enqueue(queue.id, publication.id);
    return NextResponse.json({ product, publication, item, queued: true });
  } catch { return NextResponse.json({ error: "Não foi possível atualizar o produto." }, { status: 500 }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { action?: string } | null;
  const prisma = getPrisma(); const products = new ProductRepository(prisma);
  try {
    if (body?.action === "duplicate") return NextResponse.json(await products.duplicate(id));
    if (body?.action === "archive") return NextResponse.json(await products.archive(id));
    const product = await products.findById(id);
    if (!product) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    if (body?.action === "publication" || body?.action === "queue") {
      const existingPublication = await prisma.publication.findFirst({
        where: { productId: id, deletedAt: null, status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
      });
      const publication = existingPublication ?? await new PublicationService(new PublicationRepository(prisma)).create({ type: "PRODUCT", productId: id, title: product.title, platforms: ["WHATSAPP", "TELEGRAM"] });
      if (body.action === "publication") return NextResponse.json({ publication, warning: existingPublication ? "Este produto já possui uma publicação." : undefined });
      const queueResult = await findOrCreateMainQueue();
      if (!queueResult) return NextResponse.json({ publication, warning: "Crie primeiro o grupo autorizado na área Grupos." });
      const existingItem = await prisma.queueItem.findFirst({ where: { queueId: queueResult.queue.id, publicationId: publication.id, status: { in: ["PENDING", "SCHEDULED", "PROCESSING", "PAUSED"] } } });
      if (existingItem) return NextResponse.json({ publication, item: existingItem, warning: "Esta publicação já está na fila." });
      const item = await new QueueService(new QueueRepository(prisma)).enqueue(queueResult.queue.id, publication.id);
      return NextResponse.json({ publication, item, warning: queueResult.created ? "Fila principal criada pausada e produto adicionado." : "Produto adicionado à fila." });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch { return NextResponse.json({ error: "Não foi possível concluir a ação." }, { status: 500 }); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  const { id } = await context.params;
  try { await new ProductRepository(getPrisma()).softDelete(id); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Não foi possível remover o produto." }, { status: 500 }); }
}
