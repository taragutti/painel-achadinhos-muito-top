import { integrationActionSchema } from "@achadinhos/shared";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { hasValidRequestOrigin } from "@/lib/auth/request";
import { integrationAction } from "@/lib/integrations/application";
export async function POST(request: Request) { const admin = await getAuthenticatedAdmin(); if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 401 }); if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 }); try { const input = integrationActionSchema.parse(await request.json()); return NextResponse.json(await integrationAction(input.type, input.action, admin.id)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Ação não concluída." }, { status: 400 }); } }
