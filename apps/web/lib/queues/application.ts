import { getPrisma, QueueRepository, QueueService } from "@achadinhos/database";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";
function repository() {
  return new QueueRepository(getPrisma());
}
export async function queueWorkspace() {
  await requireAuthenticatedAdmin();
  const repo = repository();
  const [queues, channels, publications, paused] = await Promise.all([
    repo.list(),
    repo.listChannels(),
    repo.listPublications(),
    repo.isGloballyPaused(),
  ]);
  return { queues, channels, publications, paused };
}
export async function createQueue(
  input: Parameters<QueueService["create"]>[0],
) {
  return new QueueService(repository()).create(input);
}
export async function addQueueItem(
  queueId: string,
  publicationId: string,
  priority: number,
) {
  return new QueueService(repository()).enqueue(
    queueId,
    publicationId,
    priority,
  );
}
export async function runQueueAction(
  queueId: string,
  input: {
    action: string;
    itemId?: string;
    priority?: number;
    orderedItemIds?: string[];
  },
) {
  const repo = repository();
  if (input.action === "START" || input.action === "RESUME")
    return repo.setStatus(queueId, "ACTIVE");
  if (input.action === "PAUSE") return repo.setStatus(queueId, "PAUSED");
  if (input.action === "COMPLETE") return repo.setStatus(queueId, "COMPLETED");
  if (input.action === "CLEAR_PENDING") return repo.clearPending(queueId);
  if (input.action === "REORDER" && input.orderedItemIds)
    return repo.reorder(queueId, input.orderedItemIds);
  if (!input.itemId) throw new Error("Item obrigatório.");
  if (input.action === "PAUSE_ITEM")
    return repo.updateItem(input.itemId, { status: "PAUSED" });
  if (input.action === "REMOVE_ITEM")
    return repo.updateItem(input.itemId, { status: "CANCELLED" });
  if (input.action === "DUPLICATE_ITEM")
    return repo.duplicateItem(input.itemId);
  if (input.action === "SET_PRIORITY" && input.priority !== undefined)
    return repo.updateItem(input.itemId, { priority: input.priority });
  if (input.action === "RETRY_ITEM")
    return repo.retryFailedItem(input.itemId);
  throw new Error("Ação inválida.");
}
export async function setGlobalPause(paused: boolean) {
  return repository().setGlobalPause(paused);
}
