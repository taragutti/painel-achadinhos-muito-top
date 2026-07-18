import { integrationUpdateSchema } from "@achadinhos/shared";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { hasValidRequestOrigin } from "@/lib/auth/request";
import { listIntegrations, saveIntegration } from "@/lib/integrations/application";

export async function GET() { if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 }); return NextResponse.json({ integrations: await listIntegrations(), sendLive: false }); }
export async function PUT(request: Request) {
  const admin = await getAuthenticatedAdmin(); if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  try { const input = integrationUpdateSchema.parse(await request.json()); await saveIntegration(input, admin.id); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a integração." }, { status: 400 }); }
}
