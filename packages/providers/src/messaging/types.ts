export type MessagingPlatform = "MOCK" | "TELEGRAM" | "WHATSAPP";
export type ConnectionState = "DISCONNECTED" | "WAITING_QR" | "CONNECTING" | "CONNECTED" | "ERROR";

export type ProviderStatus = {
  platform: MessagingPlatform;
  state: ConnectionState;
  configured: boolean;
  lastTestAt?: Date;
  lastHeartbeatAt?: Date;
  lastError?: string;
};

export type AvailableChannel = { externalId: string; name: string; kind: "GROUP" };
export type SendInput = {
  destination: string;
  text: string;
  idempotencyKey: string;
  imageUrl?: string;
};
export type SendResult = { success: boolean; providerMessageId?: string; errorCode?: string; errorMessage?: string };
export type HealthResult = { healthy: boolean; checkedAt: Date; detail?: string };

export interface MessagingProvider {
  readonly platform: MessagingPlatform;
  connect(): Promise<ProviderStatus>;
  disconnect(): Promise<void>;
  getStatus(): Promise<ProviderStatus>;
  listAvailableChannels(): Promise<AvailableChannel[]>;
  sendText(input: SendInput): Promise<SendResult>;
  sendImage(input: SendInput & { imageUrl: string }): Promise<SendResult>;
  testConnection(): Promise<HealthResult>;
  healthCheck(): Promise<HealthResult>;
}

export type SafeLogger = {
  info(event: string, metadata?: Readonly<Record<string, unknown>>): void;
  warn(event: string, metadata?: Readonly<Record<string, unknown>>): void;
  error(event: string, metadata?: Readonly<Record<string, unknown>>): void;
};

export const silentLogger: SafeLogger = { info() {}, warn() {}, error() {} };
export function sanitizeProviderError(value: unknown): string {
  const message = value instanceof Error ? value.message : "Falha no provider.";
  return message.replace(/bot\d+:[\w-]+/gi, "bot[REDACTED]").replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 500);
}
