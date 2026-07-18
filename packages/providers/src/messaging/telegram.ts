import { sanitizeProviderError, silentLogger, type AvailableChannel, type HealthResult, type MessagingProvider, type ProviderStatus, type SafeLogger, type SendInput, type SendResult } from "./types.js";

export type TelegramConfig = { token: string; groupId: string; groupName?: string; apiBaseUrl?: string; timeoutMs?: number; maxAttempts?: number; fetchFn?: typeof fetch };
type TelegramResponse = { ok?: boolean; result?: { message_id?: number; title?: string; type?: string }; description?: string; error_code?: number };

export class TelegramMessagingProvider implements MessagingProvider {
  readonly platform = "TELEGRAM" as const;
  private state: ProviderStatus["state"] = "DISCONNECTED";
  constructor(private readonly config: TelegramConfig, private readonly logger: SafeLogger = silentLogger) {}
  async connect() { const health = await this.testConnection(); this.state = health.healthy ? "CONNECTED" : "ERROR"; return this.getStatus(); }
  async disconnect() { this.state = "DISCONNECTED"; }
  async getStatus(): Promise<ProviderStatus> { return { platform: this.platform, state: this.state, configured: Boolean(this.config.token && this.config.groupId) }; }
  async listAvailableChannels(): Promise<AvailableChannel[]> { return [{ externalId: this.config.groupId, name: this.config.groupName ?? "Grupo configurado", kind: "GROUP" }]; }
  async sendText(input: SendInput) { return this.send("sendMessage", { chat_id: input.destination, text: input.text }, input.idempotencyKey); }
  async sendImage(input: SendInput & { imageUrl: string }) { return this.send("sendPhoto", { chat_id: input.destination, photo: input.imageUrl, caption: input.text }, input.idempotencyKey); }
  async testConnection(): Promise<HealthResult> { const result = await this.call("getChat", { chat_id: this.config.groupId }, 1); return { healthy: result.ok === true, checkedAt: new Date(), detail: result.ok ? "Conexão válida." : sanitizeProviderError(result.description) }; }
  async healthCheck() { return this.testConnection(); }
  private async send(method: string, body: Record<string, string>, idempotencyKey: string): Promise<SendResult> {
    try { const data = await this.call(method, body, this.config.maxAttempts ?? 3); return data.ok ? { success: true, providerMessageId: data.result?.message_id?.toString() } : { success: false, errorCode: String(data.error_code ?? "TELEGRAM_ERROR"), errorMessage: sanitizeProviderError(data.description) }; }
    catch (error) { const safe = sanitizeProviderError(error); this.logger.error("provider.telegram.send.failed", { idempotencyKey, errorType: error instanceof Error ? error.name : "UnknownError" }); return { success: false, errorCode: "TELEGRAM_REQUEST_FAILED", errorMessage: safe }; }
  }
  private async call(method: string, body: Record<string, string>, attempts: number): Promise<TelegramResponse> {
    const base = this.config.apiBaseUrl ?? "https://api.telegram.org";
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 8_000);
      try { const response = await (this.config.fetchFn ?? fetch)(`${base}/bot${this.config.token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal }); const data = await response.json() as TelegramResponse; if (response.ok || response.status < 500 || attempt === attempts) return data; }
      catch (error) { if (attempt === attempts) throw error; this.logger.warn("provider.telegram.retry", { attempt, errorType: error instanceof Error ? error.name : "UnknownError" }); }
      finally { clearTimeout(timer); }
    }
    return { ok: false, description: "Limite de tentativas excedido." };
  }
}
