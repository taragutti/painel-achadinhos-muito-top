import { getPrisma, TemplateRepository } from "@achadinhos/database";
import { messageTemplateInputSchema, sanitizeMessageText } from "@achadinhos/shared";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { hasValidRequestOrigin } from "@/lib/auth/request";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  const parsed = messageTemplateInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revise os dados do modelo." }, { status: 400 });
  try { const { id } = await context.params; return NextResponse.json(await new TemplateRepository(getPrisma()).update(id, { ...parsed.data, content: sanitizeMessageText(parsed.data.content) }, parsed.data.platform)); }
  catch { return NextResponse.json({ error: "Não foi possível atualizar o modelo." }, { status: 500 }); }
}
