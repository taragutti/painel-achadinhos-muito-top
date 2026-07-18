import type { QueueRepository, QueueCreateInput } from "../repositories/queue-repository.js";
export class QueueService {
  constructor(private readonly queues: QueueRepository) {}
  create(input: QueueCreateInput) { if (input.itemsPerBatch < 1 || input.itemsPerBatch > 10) throw new Error("Items per batch must be between 1 and 10"); if (input.intervalMinutes < 1) throw new Error("Interval must be at least one minute"); return this.queues.create(input); }
  enqueue(queueId: string, publicationId: string, priority = 0, scheduledFor?: Date) { if (!queueId.trim() || !publicationId.trim()) throw new Error("Queue and publication are required"); return this.queues.enqueue(queueId, publicationId, priority, scheduledFor); }
}
