import { getPrisma, PublicationRepository, QueueRepository, QueueService } from "@achadinhos/database";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { hasValidRequestOrigin } from "@/lib/auth/request";
import { publicationComposerSchema, sanitizeMessageText, validateProviderMessage } from "@achadinhos/shared";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  const parsed = publicationComposerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revise os campos e destinos." }, { status: 400 });
  let text = sanitizeMessageText(parsed.data.customMessage).trim();
  if (parsed.data.couponCode && !text.includes(parsed.data.couponCode)) text += `\n\n🎟️ Cupom: ${parsed.data.couponCode}`;
  if (parsed.data.destinationLink && !text.includes(parsed.data.destinationLink)) text += `\n\n${parsed.data.destinationLink}`;
  if (parsed.data.platforms.some((platform) => !validateProviderMessage(text, platform, Boolean(parsed.data.mediaUrl)).valid)) return NextResponse.json({ error: "A mensagem ultrapassa o limite do canal." }, { status: 422 });
  try {
    const { id } = await context.params;
    const { intent, templateId, ...data } = parsed.data;
    const publication = await new PublicationRepository(getPrisma()).update(id, { ...data, customMessage: text, template: templateId ? { connect: { id: templateId } } : { disconnect: true }, status: intent === "QUEUE" ? "QUEUED" : "DRAFT" });
    if (intent === "QUEUE") {
      const prisma = getPrisma();
      const queue = await prisma.publishingQueue.findFirst({ where: { status: { in: ["ACTIVE", "PAUSED"] } } });
      if (queue) return NextResponse.json({ publication, item: await new QueueService(new QueueRepository(prisma)).enqueue(queue.id, id), queued: true });
      return NextResponse.json({ publication, queued: false, warning: "Atualizada, mas nenhuma fila está configurada." });
    }
    return NextResponse.json({ publication, queued: false });
  }
  catch { return NextResponse.json({ error: "Não foi possível atualizar." }, { status: 500 }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  const { id } = await context.params; const body = await request.json().catch(() => null) as { action?: string } | null;
  const prisma = getPrisma(); const publications = new PublicationRepository(prisma);
  try {
    if (body?.action === "duplicate") return NextResponse.json(await publications.duplicate(id));
    if (body?.action === "archive") return NextResponse.json(await publications.archive(id));
    if (body?.action === "test") {
      await prisma.publicationAttempt.create({ data: { publicationId: id, provider: "mock-test", success: true, response: "Simulação local; nenhuma mensagem enviada." } });
      return NextResponse.json({ simulated: true });
    }
    if (body?.action === "queue") {
      const queue = await prisma.publishingQueue.findFirst({ where: { status: { in: ["ACTIVE", "PAUSED"] } }, orderBy: { createdAt: "asc" } });
      if (!queue) return NextResponse.json({ warning: "Nenhuma fila está configurada." });
      return NextResponse.json(await new QueueService(new QueueRepository(prisma)).enqueue(queue.id, id));
    }
    if (body?.action === "remove-queue") return NextResponse.json(await new QueueRepository(prisma).removePendingPublication(id));
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch { return NextResponse.json({ error: "Não foi possível concluir a ação." }, { status: 500 }); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  try { const { id } = await context.params; await new PublicationRepository(getPrisma()).softDelete(id); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Não foi possível remover." }, { status: 500 }); }
}
