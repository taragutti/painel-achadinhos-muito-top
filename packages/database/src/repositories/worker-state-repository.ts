import type { Prisma, PrismaClient } from "@prisma/client";
export type WorkerState = {
  runId: string;
  startedAt: string;
  lastHeartbeatAt: string;
  lastProcessingAt?: string;
  processed: number;
  succeeded: number;
  failed: number;
  lastError?: string;
};
export class WorkerStateRepository {
  constructor(private readonly prisma: PrismaClient) {}
  save(state: WorkerState) {
    return this.prisma.appSetting.upsert({
      where: { key: "worker.state" },
      create: {
        key: "worker.state",
        value: state as unknown as Prisma.InputJsonValue,
      },
      update: { value: state as unknown as Prisma.InputJsonValue },
    });
  }
  get() {
    return this.prisma.appSetting.findUnique({
      where: { key: "worker.state" },
    });
  }
  async getDemoBehavior() {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: "demo.behavior" },
    });
    const value = row?.value;
    return value === "FAILURE" || value === "TIMEOUT" ? value : "SUCCESS";
  }
  setDemoBehavior(value: "SUCCESS" | "FAILURE" | "TIMEOUT") {
    return this.prisma.appSetting.upsert({
      where: { key: "demo.behavior" },
      create: { key: "demo.behavior", value },
      update: { value },
    });
  }
}
