import {
  DeliveryRepository,
  disconnectPrisma,
  getPrisma,
  QueueRepository,
  WorkerStateRepository,
} from "@achadinhos/database";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import {
  createTelegramProvider,
  MockMessagingProvider,
  shouldUseMock,
  WhatsAppMessagingProvider,
  type MessagingProvider,
} from "@achadinhos/providers";
import { buildProductMessage, nextAllowedTime } from "@achadinhos/shared";
import { installSafeConsoleGuard, safeLogger } from "./safe-logger.js";
import { WorkerWhatsAppConnector } from "./whatsapp-connector.js";
import { startHealthServer, type WorkerHealthState } from "./health-server.js";
import {
  shouldAutostartWhatsapp,
  validateWorkerEnvironment,
} from "./runtime-config.js";

process.env.APP_RUNTIME = "worker";
installSafeConsoleGuard();
validateWorkerEnvironment(process.env);
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
let shuttingDown = false;
let activeTick: Promise<void> | null = null;
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
    const product = item.publication.product;
    const text =
      item.publication.customMessage ??
      (product
        ? buildProductMessage({
            title: product.title,
            description: product.description,
            currentPrice: product.currentPrice?.toString(),
            oldPrice: product.oldPrice?.toString(),
            couponCode: product.couponCode,
            affiliateUrl: product.affiliateUrl,
            storeName: product.storeName,
            marketplace: product.marketplace,
          })
        : item.publication.title ?? "Publicação");
    const mediaUrl =
      item.publication.mediaUrl ??
      product?.storedImageUrl ??
      product?.originalImageUrl ??
      undefined;
    const idempotencyKey = `${item.id}:${target.channelId}:${attemptNumber}`;
    const delivery = await deliveries.start({
      queueItemId: item.id,
      channelId: target.channelId,
      attemptNumber,
      idempotencyKey,
      messageSnapshot: text,
      mediaUrlSnapshot: mediaUrl,
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
    const result = mediaUrl
      ? await provider.sendImage({
          ...input,
          imageUrl: mediaUrl,
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
  if (running || shuttingDown) return;
  running = true;
  try {
    const now = new Date();
    state.lastHeartbeatAt = now.toISOString();
    await scheduleRound(now);
    await deliverItem(now);
    state.lastSuccessfulCycleAt = new Date().toISOString();
    state.lastError = undefined;
  } catch (error) {
    state.lastError = error instanceof Error ? error.name : "UnknownError";
    safeLogger.error("worker.queue.failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
  } finally {
    await workerStates.save(state).catch((error) => {
      state.lastError =
        error instanceof Error ? error.name : "WorkerStatePersistenceError";
      safeLogger.error("worker.state.failed", {
        errorType:
          error instanceof Error ? error.name : "WorkerStatePersistenceError",
      });
    });
    running = false;
  }
}

function runTick(): void {
  if (activeTick || shuttingDown) return;
  const work = tick();
  activeTick = work;
  void work.finally(() => {
    if (activeTick === work) activeTick = null;
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

safeLogger.info("worker.started", {
  runId: state.runId,
  mockProviders: shouldUseMock(process.env),
  sendLive: process.env.SEND_LIVE === "true",
});
const healthServer = startHealthServer(
  state,
  process.env.WORKER_HEALTH_TOKEN,
  process.env.WORKER_API_TOKEN,
  whatsappConnector,
  Number(process.env.PORT ?? process.env.WORKER_HEALTH_PORT ?? 9464),
  process.env.WORKER_HEALTH_HOST ?? "127.0.0.1",
);
if (shouldAutostartWhatsapp(process.env)) {
  void whatsappConnector.connect().catch((error) => {
    safeLogger.error("whatsapp.start.failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
  });
}
runTick();
const tickTimer = setInterval(runTick, interval);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(tickTimer);
  safeLogger.info("worker.shutdown.started", { signal });

  if (activeTick) await activeTick.catch(() => undefined);
  const results = await Promise.allSettled([
    whatsappConnector.disconnect(),
    closeServer(healthServer),
    disconnectPrisma(),
  ]);
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed > 0) {
    process.exitCode = 1;
    safeLogger.error("worker.shutdown.failed", { failedResources: failed });
    return;
  }
  safeLogger.info("worker.shutdown.completed", { signal });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
