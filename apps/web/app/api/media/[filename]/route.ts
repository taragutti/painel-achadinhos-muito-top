import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { readStoredImage } from "@/lib/products/storage";

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  if (!await getAuthenticatedAdmin()) return new NextResponse(null, { status: 401 });
  try {
    const { filename } = await context.params;
    const image = await readStoredImage(filename);
    return new NextResponse(new Uint8Array(image), { headers: { "content-type": "image/webp", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" } });
  } catch { return new NextResponse(null, { status: 404 }); }
}
