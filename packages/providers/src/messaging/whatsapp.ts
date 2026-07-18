import { sanitizeProviderError, silentLogger, type AvailableChannel, type HealthResult, type MessagingProvider, type ProviderStatus, type SafeLogger, type SendInput, type SendResult } from "./types.js";

export interface WhatsAppConnector {
  connect(): Promise<void>; disconnect(): Promise<void>; revokeSession(): Promise<void>;
  getStatus(): Promise<ProviderStatus>; getQrCode(): Promise<{ value: string; expiresAt: Date } | null>;
  listGroups(): Promise<AvailableChannel[]>; sendText(input: SendInput): Promise<SendResult>;
  sendImage(input: SendInput & { imageUrl: string }): Promise<SendResult>; healthCheck(): Promise<HealthResult>;
}

export class WhatsAppMessagingProvider implements MessagingProvider {
  readonly platform = "WHATSAPP" as const;
  constructor(private readonly connector: WhatsAppConnector, private readonly allowedGroupId: string, private readonly logger: SafeLogger = silentLogger) {
    if (process.env.APP_RUNTIME !== "worker") throw new Error("O provider WhatsApp só pode ser criado no worker.");
  }
  connect() { return this.connector.connect().then(() => this.getStatus()); }
  disconnect() { return this.connector.disconnect(); }
  getStatus() { return this.connector.getStatus(); }
  async listAvailableChannels() { return (await this.connector.listGroups()).filter((channel) => channel.kind === "GROUP"); }
  sendText(input: SendInput) { this.assertDestination(input.destination); return this.safeSend(() => this.connector.sendText(input)); }
  sendImage(input: SendInput & { imageUrl: string }) { this.assertDestination(input.destination); return this.safeSend(() => this.connector.sendImage(input)); }
  testConnection() { return this.connector.healthCheck(); }
  healthCheck() { return this.connector.healthCheck(); }
  getQrCode() { return this.connector.getQrCode(); }
  revokeSession() { return this.connector.revokeSession(); }
  private assertDestination(destination: string) { if (!destination.endsWith("@g.us") || destination !== this.allowedGroupId) throw new Error("Destino do WhatsApp não autorizado."); }
  private async safeSend(send: () => Promise<SendResult>) { try { return await send(); } catch (error) { this.logger.error("provider.whatsapp.send.failed", { errorType: error instanceof Error ? error.name : "UnknownError" }); return { success: false, errorCode: "WHATSAPP_SEND_FAILED", errorMessage: sanitizeProviderError(error) }; } }
}
