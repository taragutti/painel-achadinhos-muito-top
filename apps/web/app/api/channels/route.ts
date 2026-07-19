import { channelInputSchema } from "@achadinhos/shared";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { hasValidRequestOrigin } from "@/lib/auth/request";
import { createSimulationChannel, listChannels } from "@/lib/channels/application";

export async function GET() {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  return NextResponse.json({ channels: await listChannels() });
}

export async function POST(request: Request) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const parsed = channelInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe um nome válido para o canal." }, { status: 400 });
  try {
    return NextResponse.json({ channel: await createSimulationChannel(parsed.data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar o canal." }, { status: 409 });
  }
}
