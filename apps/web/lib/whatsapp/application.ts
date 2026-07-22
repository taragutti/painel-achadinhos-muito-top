import { CredentialCipher, getPrisma } from "@achadinhos/database";
import QRCode from "qrcode";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";

export type WhatsAppControlStatus = {
  status: {
    state: "DISCONNECTED" | "WAITING_QR" | "CONNECTING" | "CONNECTED" | "ERROR";
    configured: boolean;
    lastError?: string;
  };
  qrImage: string | null;
  qrExpiresAt: string | null;
  selectedGroup: { groupId: string; groupName: string } | null;
};

export async function whatsappStatus(): Promise<WhatsAppControlStatus> {
  await requireAuthenticatedAdmin();
  const result = await workerRequest<{
    status: WhatsAppControlStatus["status"];
    qr: { value: string; expiresAt: string } | null;
    selectedGroup: WhatsAppControlStatus["selectedGroup"];
  }>("/control/whatsapp/status");
  return {
    status: result.status,
    qrImage: result.qr
      ? await QRCode.toDataURL(result.qr.value, { errorCorrectionLevel: "M", margin: 2, width: 320 })
      : null,
    qrExpiresAt: result.qr?.expiresAt ?? null,
    selectedGroup: result.selectedGroup,
  };
}

export async function whatsappGroups() {
  await requireAuthenticatedAdmin();
  return workerRequest<{ groups: Array<{ externalId: string; name: string; kind: "GROUP" }> }>(
    "/control/whatsapp/groups",
  );
}

export async function whatsappCommand(
  action: "connect" | "disconnect" | "revoke",
) {
  const admin = await requireAuthenticatedAdmin();
  const result = await workerRequest<Record<string, string>>(`/control/whatsapp/${action}`, {
    method: "POST",
  });
  await getPrisma().auditLog.create({
    data: {
      userId: admin.id,
      action: `WHATSAPP_${action.toUpperCase()}`,
      entityType: "Integration",
      metadata: { liveSending: false },
    },
  });
  return result;
}

export async function selectWhatsAppGroup(input: { groupId: string; groupName: string }) {
  const admin = await requireAuthenticatedAdmin();
  if (!input.groupId.endsWith("@g.us") || input.groupName.trim().length < 1 || input.groupName.length > 120) {
    throw new Error("Selecione um grupo válido.");
  }
  await workerRequest("/control/whatsapp/select-group", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const encryptionKey = process.env.APP_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("Criptografia do servidor não configurada.");
  const encryptedId = new CredentialCipher(encryptionKey).encrypt({ groupId: input.groupId });
  const prisma = getPrisma();
  await prisma.$transaction(async (transaction) => {
    await transaction.channel.updateMany({
      where: { platform: "WHATSAPP" },
      data: { isDefault: false },
    });
    const existing = await transaction.channel.findFirst({ where: { platform: "WHATSAPP" } });
    const channel = existing
      ? await transaction.channel.update({
          where: { id: existing.id },
          data: {
            name: input.groupName,
            externalIdEncrypted: encryptedId,
            isActive: true,
            isDefault: true,
            metadata: { simulation: false, selectedByAdmin: true },
          },
        })
      : await transaction.channel.create({
          data: {
            platform: "WHATSAPP",
            name: input.groupName,
            externalIdEncrypted: encryptedId,
            isActive: true,
            isDefault: true,
            metadata: { simulation: false, selectedByAdmin: true },
          },
        });
    await transaction.auditLog.create({
      data: {
        userId: admin.id,
        action: "WHATSAPP_GROUP_SELECTED",
        entityType: "Channel",
        entityId: channel.id,
        metadata: { platform: "WHATSAPP", liveSending: false },
      },
    });
  });
  return { ok: true };
}

async function workerRequest<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = process.env.WORKER_API_URL;
  const token = process.env.WORKER_API_TOKEN;
  if (!baseUrl || !token || token.length < 24) throw new Error("Worker ainda não configurado.");
  const url = new URL(path, baseUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("A conexão com o worker precisa usar HTTPS.");
  }
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Worker indisponível.");
  return body;
}
