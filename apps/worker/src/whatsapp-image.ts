import type { SafeHttpClient } from "@achadinhos/providers";
import { validateImageSignature } from "@achadinhos/providers";

type WhatsAppImageClient = Pick<SafeHttpClient, "get">;

export async function downloadWhatsAppImage(
  imageUrl: string,
  client: WhatsAppImageClient,
): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    throw new Error("Imagem da publicação possui uma URL inválida.");
  }

  const response = await client.get(url);
  const contentType = response.contentType
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (
    contentType !== "application/octet-stream" &&
    !contentType.startsWith("image/")
  ) {
    throw new Error("A URL da publicação não retornou uma imagem.");
  }
  validateImageSignature(response.body);
  return Buffer.from(response.body);
}
