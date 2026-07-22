import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { hasValidRequestOrigin } from "@/lib/auth/request";
import {
  selectWhatsAppGroup,
  whatsappCommand,
  whatsappGroups,
  whatsappStatus,
} from "@/lib/whatsapp/application";

type Context = { params: Promise<{ action: string }> };

export async function GET(_request: Request, context: Context) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const { action } = await context.params;
    if (action === "status") return NextResponse.json(await whatsappStatus());
    if (action === "groups") return NextResponse.json(await whatsappGroups());
    return NextResponse.json({ error: "Ação inválida." }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request, context: Context) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  try {
    const { action } = await context.params;
    if (action === "connect" || action === "disconnect" || action === "revoke") {
      return NextResponse.json(await whatsappCommand(action));
    }
    if (action === "select-group") {
      const body = await request.json().catch(() => null) as { groupId?: unknown; groupName?: unknown } | null;
      if (typeof body?.groupId !== "string" || typeof body.groupName !== "string") {
        return NextResponse.json({ error: "Grupo inválido." }, { status: 400 });
      }
      return NextResponse.json(await selectWhatsAppGroup({ groupId: body.groupId, groupName: body.groupName }));
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }
}

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 200) : "Não foi possível controlar o WhatsApp.";
}
