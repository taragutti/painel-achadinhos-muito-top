import { prisma } from "@achadinhos/database";
import { createProvider } from "@achadinhos/providers";

const interval = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5_000);
let running = false;

async function processQueue() {
  if (running) return;
  running = true;
  try {
    const publication = await prisma.publication.findFirst({
      where: { status: "QUEUED", scheduledAt: { lte: new Date() } },
      include: { product: true },
      orderBy: { scheduledAt: "asc" },
    });
    if (!publication) return;

    await prisma.publication.update({ where: { id: publication.id }, data: { status: "PROCESSING" } });
    const provider = createProvider(publication.channel.toLowerCase());
    const result = await provider.publish({
      publicationId: publication.id,
      destination: publication.destination,
      text: publication.renderedText,
      link: publication.product.affiliateUrl,
    });

    await prisma.$transaction([
      prisma.publicationAttempt.create({
        data: { publicationId: publication.id, provider: provider.name, success: result.success, externalId: result.externalId, response: result.detail },
      }),
      prisma.publication.update({
        where: { id: publication.id },
        data: { status: result.success ? "PUBLISHED" : "FAILED", publishedAt: result.success ? new Date() : null },
      }),
    ]);
  } catch (error) {
    console.error("Falha ao processar a fila", error);
  } finally {
    running = false;
  }
}

console.info(`Worker iniciado em modo ${process.env.PROVIDER_MODE ?? "test"}.`);
void processQueue();
setInterval(() => void processQueue(), interval);
