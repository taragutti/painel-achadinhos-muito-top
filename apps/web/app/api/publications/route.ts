import { publicationComposerSchema } from "@achadinhos/shared";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { hasValidRequestOrigin } from "@/lib/auth/request";
import { createComposedPublication } from "@/lib/publications/application";

export async function POST(request: Request) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  const parsed = publicationComposerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revise os campos e os destinos." }, { status: 400 });
  if (parsed.data.type === "ART_LINK" && (!parsed.data.mediaUrl || !parsed.data.destinationLink)) return NextResponse.json({ error: "Arte com link exige imagem e link." }, { status: 400 });
  try { return NextResponse.json(await createComposedPublication(parsed.data), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "MESSAGE_LENGTH_INVALID" ? "A mensagem ultrapassa o limite do canal selecionado." : "Não foi possível salvar a publicação." }, { status: 422 }); }
}
