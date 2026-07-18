import { productSaveInputSchema } from "@achadinhos/shared";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { hasValidRequestOrigin } from "@/lib/auth/request";
import { saveProduct } from "@/lib/products/application";

export async function POST(request: Request) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  const body = await request.json().catch(() => null) as { product?: unknown; intent?: unknown; queueId?: unknown } | null;
  const parsed = productSaveInputSchema.safeParse(body?.product);
  if (!parsed.success || (body?.intent !== "DRAFT" && body?.intent !== "QUEUE")) return NextResponse.json({ error: "Revise os campos informados." }, { status: 400 });
  try { return NextResponse.json(await saveProduct(parsed.data, body.intent, typeof body.queueId === "string" ? body.queueId : undefined), { status: 201 }); }
  catch (error) {
    console.error("Product save failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível salvar o produto." }, { status: 500 });
  }
}
