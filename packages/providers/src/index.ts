import { publicationPayloadSchema, type PublicationPayload, type PublicationProvider, type PublicationResult } from "@achadinhos/shared";

class TestProvider implements PublicationProvider {
  readonly name = "test";
  async publish(input: PublicationPayload): Promise<PublicationResult> {
    const payload = publicationPayloadSchema.parse(input);
    console.info("[TESTE] Publicação simulada", { id: payload.publicationId, destination: payload.destination });
    return { success: true, externalId: `test-${payload.publicationId}`, detail: "Nenhuma mensagem real foi enviada." };
  }
}

class TelegramProvider implements PublicationProvider {
  readonly name = "telegram";
  async publish(input: PublicationPayload): Promise<PublicationResult> {
    const payload = publicationPayloadSchema.parse(input);
    const token = required("TELEGRAM_BOT_TOKEN");
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: payload.destination, text: [payload.text, payload.link].filter(Boolean).join("\n\n"), disable_web_page_preview: false }),
    });
    const data = await response.json() as { ok?: boolean; result?: { message_id?: number }; description?: string };
    return { success: response.ok && data.ok === true, externalId: data.result?.message_id?.toString(), detail: data.description };
  }
}

class WhatsAppProvider implements PublicationProvider {
  readonly name = "whatsapp";
  async publish(input: PublicationPayload): Promise<PublicationResult> {
    const payload = publicationPayloadSchema.parse(input);
    const token = required("WHATSAPP_ACCESS_TOKEN");
    const phoneId = required("WHATSAPP_PHONE_NUMBER_ID");
    const version = process.env.WHATSAPP_API_VERSION ?? "v23.0";
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: payload.destination, type: "text", text: { preview_url: true, body: [payload.text, payload.link].filter(Boolean).join("\n\n") } }),
    });
    const data = await response.json() as { messages?: Array<{ id: string }>; error?: { message?: string } };
    return { success: response.ok, externalId: data.messages?.[0]?.id, detail: data.error?.message };
  }
}

function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Variável obrigatória ausente: ${key}`);
  return value;
}

export function createProvider(channel: string): PublicationProvider {
  if ((process.env.PROVIDER_MODE ?? "test") === "test") return new TestProvider();
  if (channel === "telegram") return new TelegramProvider();
  if (channel === "whatsapp") return new WhatsAppProvider();
  throw new Error(`Canal não suportado: ${channel}`);
}
