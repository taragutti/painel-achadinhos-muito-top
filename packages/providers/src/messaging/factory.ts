import { MockMessagingProvider, type DeliveryRecorder, type MockBehavior } from "./mock.js";
import { TelegramMessagingProvider } from "./telegram.js";
import type { MessagingProvider, SafeLogger } from "./types.js";

export type ProviderEnvironment = Readonly<Record<string, string | undefined>>;
export function shouldUseMock(environment: ProviderEnvironment = process.env) { return environment.DEMO_MODE === "true" || environment.SEND_LIVE !== "true" || environment.MOCK_PROVIDERS !== "false"; }
export function createTelegramProvider(environment: ProviderEnvironment = process.env, logger?: SafeLogger, recorder?: DeliveryRecorder): MessagingProvider {
  if (shouldUseMock(environment) || environment.TELEGRAM_ENABLED !== "true") return new MockMessagingProvider((environment.MOCK_PROVIDER_BEHAVIOR as MockBehavior) ?? "SUCCESS", logger, recorder);
  if (!environment.TELEGRAM_BOT_TOKEN || !environment.TELEGRAM_GROUP_ID) throw new Error("Integração do Telegram não configurada.");
  return new TelegramMessagingProvider({ token: environment.TELEGRAM_BOT_TOKEN, groupId: environment.TELEGRAM_GROUP_ID, groupName: environment.TELEGRAM_GROUP_NAME }, logger);
}
