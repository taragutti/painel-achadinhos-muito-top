import { ProductImportService } from "@achadinhos/providers";
import { productImportInputSchema } from "@achadinhos/shared";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { hasValidRequestOrigin } from "@/lib/auth/request";

export async function POST(request: Request) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  const parsed = productImportInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe um link HTTP ou HTTPS válido." }, { status: 400 });
  try { return NextResponse.json(await new ProductImportService().import(parsed.data.url)); }
  catch (error) {
    const privateUrl = error instanceof Error && error.message.includes("PRIVATE");
    return NextResponse.json({ error: privateUrl ? "Endereços locais ou privados não são permitidos." : "Não foi possível importar este endereço." }, { status: privateUrl ? 400 : 422 });
  }
}
