import { randomUUID } from "node:crypto";
import { silentLogger, type AvailableChannel, type HealthResult, type MessagingProvider, type ProviderStatus, type SafeLogger, type SendInput, type SendResult } from "./types.js";

export type MockBehavior = "SUCCESS" | "FAILURE" | "TIMEOUT";
export type DeliveryRecorder = (result: SendResult) => Promise<void>;

export class MockMessagingProvider implements MessagingProvider {
  readonly platform = "MOCK" as const;
  private connected = false;
  constructor(private readonly behavior: MockBehavior = "SUCCESS", private readonly logger: SafeLogger = silentLogger, private readonly recordDelivery?: DeliveryRecorder) {}

  async connect() { this.connected = true; this.logger.info("provider.mock.connected"); return this.getStatus(); }
  async disconnect() { this.connected = false; this.logger.info("provider.mock.disconnected"); }
  async getStatus(): Promise<ProviderStatus> { return { platform: this.platform, state: this.connected ? "CONNECTED" : "DISCONNECTED", configured: true }; }
  async listAvailableChannels(): Promise<AvailableChannel[]> { return [{ externalId: "mock-group", name: "Grupo de testes", kind: "GROUP" }]; }
  async sendText(input: SendInput) { return this.simulate(input); }
  async sendImage(input: SendInput & { imageUrl: string }) { return this.simulate(input); }
  async testConnection(): Promise<HealthResult> { return this.healthCheck(); }
  async healthCheck(): Promise<HealthResult> { return { healthy: this.behavior !== "FAILURE", checkedAt: new Date(), detail: "Verificação simulada." }; }

  private async simulate(input: SendInput): Promise<SendResult> {
    this.logger.info("provider.mock.send.started", { idempotencyKey: input.idempotencyKey, behavior: this.behavior });
    let result: SendResult;
    if (this.behavior === "TIMEOUT") result = { success: false, errorCode: "MOCK_TIMEOUT", errorMessage: "Tempo limite simulado." };
    else if (this.behavior === "FAILURE") result = { success: false, errorCode: "MOCK_FAILURE", errorMessage: "Falha simulada." };
    else result = { success: true, providerMessageId: `mock-${randomUUID()}` };
    await this.recordDelivery?.(result);
    this.logger.info("provider.mock.send.completed", { idempotencyKey: input.idempotencyKey, success: result.success, errorCode: result.errorCode });
    return result;
  }
}
