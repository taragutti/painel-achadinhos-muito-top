import {
  DeliveryRepository,
  getPrisma,
  QueueRepository,
  WorkerStateRepository,
} from "@achadinhos/database";
import { randomUUID } from "node:crypto";
import {
  createTelegramProvider,
  MockMessagingProvider,
  shouldUseMock,
  WhatsAppMessagingProvider,
  type MessagingProvider,
} from "@achadinhos/providers";
import { nextAllowedTime } from "@achadinhos/shared";
import { safeLogger } from "./safe-logger.js";
import { WorkerWhatsAppConnector } from "./whatsapp-connector.js";
import { startHealthServer, type WorkerHealthState } from "./health-server.js";

process.env.APP_RUNTIME = "worker";
const interval = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5_000);
const maxAttempts = Math.min(3, Number(process.env.DELIVERY_MAX_ATTEMPTS ?? 3));
const prisma = getPrisma();
const queues = new QueueRepository(prisma);
const deliveries = new DeliveryRepository(prisma);
const workerStates = new WorkerStateRepository(prisma);
const whatsappConnector = new WorkerWhatsAppConnector(
  process.env.WHATSAPP_SESSION_DIR ?? "../../var/whatsapp-session",
  process.env.WHATSAPP_ALLOWED_GROUP_ID ?? "",
);
const startedAt = new Date().toISOString();
const state: WorkerHealthState = {
  runId: randomUUID(),
  startedAt,
  lastHeartbeatAt: startedAt,
  processed: 0,
  succeeded: 0,
  failed: 0,
};
let running = false;
function providerFor(
  platform: "TELEGRAM" | "WHATSAPP",
  demoBehavior: "SUCCESS" | "FAILURE" | "TIMEOUT",
): MessagingProvider {
  if (shouldUseMock(process.env))
    return new MockMessagingProvider(
      process.env.DEMO_MODE === "true"
        ? demoBehavior
        : ((process.env.MOCK_PROVIDER_BEHAVIOR as
            | "SUCCESS"
            | "FAILURE"
            | "TIMEOUT") ?? "SUCCESS"),
      safeLogger,
    );
  if (platform === "TELEGRAM")
    return createTelegramProvider(process.env, safeLogger);
  const selectedGroupId = whatsappConnector.getSelectedGroup()?.groupId ?? "";
  return new WhatsAppMessagingProvider(
    whatsappConnector,
    selectedGroupId,
    safeLogger,
  );
}
async function scheduleRound(now: Date) {
  if (await queues.isGloballyPaused()) return;
  const queue = await queues.claimDueQueue(
    now,
    Number(process.env.QUEUE_LOCK_LEASE_SECONDS ?? 120),
  );
  if (!queue?.lockToken) return;
  try {
    const allowedAt = nextAllowedTime(
      now,
      queue.dailyStartTime,
      queue.dailyEndTime,
      queue.timezone,
    );
    if (allowedAt > now) {
      await queues.releaseQueue(queue.id, queue.lockToken, allowedAt);
      return;
    }
    await queues.scheduleBatch(queue.id, queue.lockToken, now);
    await queues.releaseQueue(
      queue.id,
      queue.lockToken,
      new Date(now.getTime() + queue.intervalMinutes * 60000),
    );
  } catch (error) {
    await queues.releaseQueue(
      queue.id,
      queue.lockToken,
      new Date(now.getTime() + 60000),
    );
    throw error;
  }
}
async function deliverItem(now: Date) {
  if (await queues.isGloballyPaused()) return;
  const item = await queues.claimDueItem(now);
  if (!item) return;
  const history = await deliveries.listForItem(item.id);
  const demoBehavior = await workerStates.getDemoBehavior();
  let needsRetry = false;
  let exhausted = false;
  for (const target of item.queue.targets) {
    if (!(await queues.canProcessItem(item.id))) {
      await queues.finishItem(
        item.id,
        "RETRY",
        now,
        new Date(now.getTime() + 60000),
      );
      return;
    }
    const attempts = history.filter(
      (delivery) => delivery.channelId === target.channelId,
    );
    if (attempts.some((delivery) => delivery.status === "SENT")) continue;
    if (attempts.length >= maxAttempts) {
      exhausted = true;
      continue;
    }
    const attemptNumber = attempts.length + 1;
    const text =
      item.publication.customMessage ?? item.publication.title ?? "Publicação";
    const idempotencyKey = `${item.id}:${target.channelId}:${attemptNumber}`;
    const delivery = await deliveries.start({
      queueItemId: item.id,
      channelId: target.channelId,
      attemptNumber,
      idempotencyKey,
      messageSnapshot: text,
      mediaUrlSnapshot: item.publication.mediaUrl ?? undefined,
    });
    if (delivery.status === "SENT") continue;
    const provider = providerFor(target.channel.platform, demoBehavior);
    const destination =
      provider.platform === "MOCK"
        ? "mock-group"
        : target.channel.platform === "WHATSAPP"
          ? (whatsappConnector.getSelectedGroup()?.groupId ?? "")
          : (process.env.TELEGRAM_GROUP_ID ?? "");
    const input = { destination, text, idempotencyKey };
    const result = item.publication.mediaUrl
      ? await provider.sendImage({
          ...input,
          imageUrl: item.publication.mediaUrl,
        })
      : await provider.sendText(input);
    await deliveries.complete(delivery.id, result);
    state.processed += 1;
    if (result.success) state.succeeded += 1;
    else state.failed += 1;
    state.lastProcessingAt = new Date().toISOString();
    if (!result.success) {
      if (attemptNumber < maxAttempts) needsRetry = true;
      else exhausted = true;
    }
  }
  if (needsRetry) {
    const highestAttempt = Math.max(
      1,
      ...history.map((delivery) => delivery.attemptNumber + 1),
    );
    const delayMinutes = [1, 5, 15][Math.min(highestAttempt - 1, 2)];
    await queues.finishItem(
      item.id,
      "RETRY",
      now,
      new Date(now.getTime() + delayMinutes * 60000),
    );
  } else
    await queues.finishItem(item.id, exhausted ? "FAILED" : "COMPLETED", now);
}
async function tick() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    state.lastHeartbeatAt = now.toISOString();
    await scheduleRound(now);
    await deliverItem(now);
    state.lastError = undefined;
  } catch (error) {
    state.lastError = error instanceof Error ? error.name : "UnknownError";
    safeLogger.error("worker.queue.failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
  } finally {
    await workerStates.save(state).catch(() => undefined);
    running = false;
  }
}
safeLogger.info("worker.started", {
  runId: state.runId,
  mockProviders: shouldUseMock(process.env),
  sendLive: false,
});
startHealthServer(
  state,
  process.env.WORKER_HEALTH_TOKEN,
  process.env.WORKER_API_TOKEN,
  whatsappConnector,
  Number(process.env.PORT ?? process.env.WORKER_HEALTH_PORT ?? 9464),
  process.env.WORKER_HEALTH_HOST ?? "127.0.0.1",
);
if (process.env.WHATSAPP_ENABLED === "true") {
  void whatsappConnector.connect().catch((error) => {
    safeLogger.error("whatsapp.start.failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
  });
}
void tick();
setInterval(() => void tick(), interval);
