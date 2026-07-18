import { CredentialCipher, getPrisma, IntegrationRepository } from "@achadinhos/database";
import { createTelegramProvider, MockMessagingProvider } from "@achadinhos/providers";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";

function repository() { return new IntegrationRepository(getPrisma()); }
function cipher() { const key = process.env.APP_ENCRYPTION_KEY; if (!key) throw new Error("Chave de criptografia do servidor não configurada."); return new CredentialCipher(key); }
export async function listIntegrations() {
  await requireAuthenticatedAdmin();
  const rows = await repository().listSafe();
  return rows.map(({ encryptedCredentials, ...row }) => ({ ...row, configured: Boolean(encryptedCredentials), lastError: row.lastError?.slice(0, 500) ?? null }));
}
export async function saveIntegration(input: { type: "TELEGRAM" | "WHATSAPP"; displayName?: string; secret?: string; groupId?: string; enabled: boolean }, userId?: string) {
  const repo = repository(); const item = await repo.save({ type: input.type, status: input.enabled ? "DISCONNECTED" : "DISABLED", displayName: input.displayName, metadata: { groupIdConfigured: Boolean(input.groupId) }, credentials: input.secret || input.groupId ? { token: input.secret ?? "", groupId: input.groupId ?? "" } : undefined }, cipher());
  await repo.audit(userId, "INTEGRATION_CHANGED", item.id, { type: input.type, enabled: input.enabled, credentialsChanged: Boolean(input.secret) }); return item;
}
export async function integrationAction(type: "TELEGRAM" | "WHATSAPP", action: "CONNECT" | "DISCONNECT" | "REVOKE" | "TEST", userId?: string) {
  const repo = repository(); const current = await repo.find(type); if (!current) throw new Error("Integração ainda não configurada.");
  const provider = process.env.SEND_LIVE === "true" ? (type === "TELEGRAM" ? createTelegramProvider(process.env) : new MockMessagingProvider()) : new MockMessagingProvider();
  let status = current.status; let lastError: string | null = null;
  if (action === "CONNECT") { await provider.connect(); status = type === "WHATSAPP" ? "WAITING_QR" : "CONNECTED"; }
  if (action === "DISCONNECT" || action === "REVOKE") { await provider.disconnect(); status = "DISCONNECTED"; }
  if (action === "TEST") { const health = await provider.testConnection(); lastError = health.healthy ? null : health.detail?.slice(0, 500) ?? "Falha no teste."; status = health.healthy ? current.status : "ERROR"; }
  await repo.updateStatus(type, status, { lastError, lastHeartbeatAt: action === "TEST" ? new Date() : undefined, lastConnectionAt: action === "CONNECT" ? new Date() : undefined });
  await repo.audit(userId, `INTEGRATION_${action}`, current.id, { type, mock: process.env.SEND_LIVE !== "true" }); return { ok: true, status, lastError };
}
