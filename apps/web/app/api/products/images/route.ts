import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { hasValidRequestOrigin } from "@/lib/auth/request";
import { storeRemoteImage, storeUploadedImage } from "@/lib/products/storage";

export async function POST(request: Request) {
  if (!await getAuthenticatedAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const remoteUrl = form.get("remoteUrl");
    const result = file instanceof File && file.size ? await storeUploadedImage(file) : typeof remoteUrl === "string" && remoteUrl ? await storeRemoteImage(remoteUrl) : null;
    if (!result) return NextResponse.json({ error: "Selecione uma imagem válida." }, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "IMAGE_INVALID";
    console.warn("Product image rejected", { code });
    return NextResponse.json({ error: "A imagem deve ser JPG, PNG, WebP ou AVIF e ter até 5 MB." }, { status: 422 });
  }
}
