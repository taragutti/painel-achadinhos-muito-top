import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient();
  return globalForPrisma.prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (!globalForPrisma.prisma) return;
  await globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export { Marketplace, MessageCategory, Platform, Prisma, ProductStatus, PublicationStatus, PublicationType, TemplatePlatform } from "@prisma/client";
export type { Product } from "@prisma/client";
export * from "./repositories/product-repository.js";
export * from "./repositories/publication-repository.js";
export * from "./repositories/queue-repository.js";
export * from "./repositories/template-repository.js";
export * from "./repositories/integration-repository.js";
export * from "./repositories/delivery-repository.js";
export * from "./repositories/operational-repository.js";
export * from "./repositories/worker-state-repository.js";
export * from "./services/product-service.js";
export * from "./services/publication-service.js";
export * from "./services/queue-service.js";
