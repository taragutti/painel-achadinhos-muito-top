import { getPrisma, type Platform } from "@achadinhos/database";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";

export async function listChannels() {
  await requireAuthenticatedAdmin();
  return getPrisma().channel.findMany({ orderBy: [{ platform: "asc" }, { name: "asc" }] });
}

export async function createSimulationChannel(input: { name: string; platform: Platform }) {
  const admin = await requireAuthenticatedAdmin();
  if (process.env.SEND_LIVE === "true" || process.env.MOCK_PROVIDERS === "false") {
    throw new Error("O canal de simulação exige o modo seguro.");
  }
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const channel = await transaction.channel.create({
      data: { name: input.name, platform: input.platform, isActive: true, isDefault: true, metadata: { simulation: true } },
    });
    await transaction.auditLog.create({
      data: { userId: admin.id, action: "CHANNEL_SIMULATION_CREATED", entityType: "Channel", entityId: channel.id, metadata: { platform: input.platform } },
    });
    return channel;
  });
}
