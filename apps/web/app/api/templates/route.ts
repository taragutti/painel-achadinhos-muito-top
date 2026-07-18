import { getPrisma, TemplateRepository } from "@achadinhos/database";
import { messageTemplateInputSchema, sanitizeMessageText } from "@achadinhos/shared";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { hasValidRequestOrigin } from "@/lib/auth/request";

export async function POST(request: Request) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  const parsed = messageTemplateInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revise os dados do modelo." }, { status: 400 });
  try { return NextResponse.json(await new TemplateRepository(getPrisma()).create({ ...parsed.data, content: sanitizeMessageText(parsed.data.content) }), { status: 201 }); }
  catch { return NextResponse.json({ error: "Não foi possível salvar o modelo." }, { status: 500 }); }
}
